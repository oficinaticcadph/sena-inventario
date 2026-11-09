import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { Prisma, type SolicitudBien } from '@prisma/client';
import { z } from 'zod';
import ExcelJS from 'exceljs';
import { db } from './db';
import { apiError, checkOrigin, currentUser, HttpError } from './access';
import {
  indiceBienes,
  normalizarBienes,
  solicitudBienSchema,
  type SolicitudBienData,
} from './bienes-validation';
import { originalExcelBytes, originalPdfBytes } from './gil-format';

export const CHUNK_SIZE = 524288;
const MAX_FILE = 10 * 1024 * 1024;
type Actor = Awaited<ReturnType<typeof currentUser>>;
const hash = (text: string | Uint8Array) => createHash('sha256').update(text).digest('hex');
function secret() {
  if (!process.env.NEXTAUTH_SECRET)
    throw new HttpError(500, 'Falta configurar el acceso del sistema.');
  return process.env.NEXTAUTH_SECRET;
}
async function readBytes(req: Request, max: number) {
  const reader = req.body?.getReader();
  if (!reader) return Buffer.alloc(0);
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) {
      await reader.cancel();
      throw new HttpError(413, 'La solicitud supera el tamaño permitido.');
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}
async function json(req: Request) {
  try {
    return JSON.parse((await readBytes(req, 512 * 1024)).toString('utf8'));
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(400, 'Datos de solicitud inválidos.');
  }
}
function actorName(actor: Actor) {
  return actor?.nombre || 'Consulta pública';
}
async function limit(req: Request, action: string, max: number) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'local';
  const key = action + ':' + createHmac('sha256', secret()).update(ip).digest('hex');
  const now = new Date(),
    cutoff = new Date(now.valueOf() - 3600000);
  const rows = await db.$queryRaw<
    { intentos: number }[]
  >`INSERT INTO "LimiteBienes" ("clave","intentos","ventana") VALUES (${key},1,${now}) ON CONFLICT ("clave") DO UPDATE SET "intentos"=CASE WHEN "LimiteBienes"."ventana"<${cutoff} THEN 1 ELSE "LimiteBienes"."intentos"+1 END,"ventana"=CASE WHEN "LimiteBienes"."ventana"<${cutoff} THEN ${now} ELSE "LimiteBienes"."ventana" END RETURNING "intentos"`;
  if (rows[0].intentos > max)
    throw new HttpError(429, 'Se alcanzó el límite temporal de solicitudes. Inténtalo más tarde.');
}
function createCode(id: number, key: string) {
  return `CADPH-${id}-${createHmac('sha256', secret())
    .update('bienes:' + key)
    .digest('base64url')}`;
}
function parseCode(code: string) {
  const match = /^CADPH-(\d+)-[A-Za-z0-9_-]{43}$/.exec(code.trim());
  if (!match) throw new HttpError(404, 'No se encontró una solicitud con ese código.');
  return Number(match[1]);
}
async function authorize(req: Request, id: number, actor: Actor) {
  if (!Number.isSafeInteger(id) || id < 1) throw new HttpError(404, 'Solicitud no encontrada.');
  const record = await db.solicitudBien.findUnique({ where: { id } });
  if (!record || record.deletedAt) throw new HttpError(404, 'Solicitud no encontrada.');
  if (actor?.rol === 'admin') return record;
  const code = req.headers.get('x-bienes-code') || '';
  if (
    !code ||
    parseCode(code) !== id ||
    !timingSafeEqual(Buffer.from(hash(code)), Buffer.from(record.tokenHash))
  )
    throw new HttpError(404, 'Solicitud o código no válidos.');
  return record;
}
const publicFileSelect = {
  id: true,
  version: true,
  nombre: true,
  tipo: true,
  size: true,
  sha256: true,
  actor: true,
  finalizadoAt: true,
} as const;
async function dto(id: number) {
  const record = await db.solicitudBien.findUniqueOrThrow({
    where: { id },
    include: {
      eventos: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] },
      adjuntos: {
        where: { completo: true },
        select: publicFileSelect,
        orderBy: { createdAt: 'asc' },
      },
    },
  });
  return {
    id: record.id,
    data: record.datos,
    version: record.version,
    origin: record.origen,
    registeredBy: record.registradoPor,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    events: record.eventos.map((e) => ({
      id: e.id,
      action: e.accion,
      detail: e.detalle,
      by: e.actor,
      version: e.version,
      date: e.createdAt,
    })),
    attachments: record.adjuntos.map((f) => ({
      id: f.id,
      name: f.nombre,
      type: f.tipo,
      size: f.size,
      sha256: f.sha256,
      version: f.version,
      by: f.actor,
      date: f.finalizadoAt,
    })),
  };
}
async function event(
  tx: Prisma.TransactionClient,
  record: Pick<SolicitudBien, 'id' | 'version'>,
  actor: Actor,
  action: string,
  detail: string,
  snapshot?: Prisma.InputJsonValue,
) {
  await tx.solicitudBienEvento.create({
    data: {
      solicitudId: record.id,
      version: record.version,
      accion: action,
      detalle: detail,
      actor: actorName(actor),
      autorId: actor?.id,
      snapshot,
    },
  });
}
function requireAdmin(actor: Actor) {
  if (!actor) throw new HttpError(401, 'Debes iniciar sesión.');
  if (actor.rol !== 'admin') throw new HttpError(403, 'Esta acción requiere un administrador.');
}
function filters(url: URL): Prisma.SolicitudBienWhereInput {
  const p = url.searchParams,
    from = p.get('from') || '',
    to = p.get('to') || '';
  for (const value of [from, to])
    if (
      value &&
      (!/^\d{4}-\d{2}-\d{2}$/.test(value) ||
        Number.isNaN(new Date(value).valueOf()) ||
        new Date(value).toISOString().slice(0, 10) !== value)
    )
      throw new HttpError(400, 'Rango de fechas inválido.');
  if (from && to && from > to)
    throw new HttpError(400, 'La fecha inicial no puede ser posterior a la final.');
  const type = p.get('movement'),
    dest = p.get('destination');
  if (type && !['SALIDA', 'INGRESO'].includes(type))
    throw new HttpError(400, 'Tipo de movimiento inválido.');
  if (dest && !['Área administrativa', 'Formación'].includes(dest))
    throw new HttpError(400, 'Destino inválido.');
  return {
    deletedAt: null,
    ...(p.get('q') ? { busqueda: { contains: normalizarBienes(p.get('q')!.slice(0, 160)) } } : {}),
    ...(p.get('area')
      ? { area: { contains: p.get('area')!.slice(0, 160), mode: 'insensitive' } }
      : {}),
    ...(type ? { movimiento: type } : {}),
    ...(dest ? { destino: dest } : {}),
    ...(from || to
      ? {
          fechaSolicitud: {
            ...(from ? { gte: new Date(from + 'T00:00:00Z') } : {}),
            ...(to ? { lte: new Date(to + 'T00:00:00Z') } : {}),
          },
        }
      : {}),
  };
}
async function exportHistory(url: URL) {
  const where = filters(url),
    order = url.searchParams.get('order') === 'asc' ? 'asc' : 'desc',
    wb = new ExcelJS.Workbook();
  let sheet = wb.addWorksheet('Historial filtrado');
  const columns = [
    'ID',
    'Fecha solicitud',
    'Movimiento',
    'Área',
    'Jefe o coordinador',
    'Tipo cuentadante',
    'Cuentadante',
    'Identificación',
    'Destino',
    'Ficha',
    'Ítem',
    'Código SENA',
    'Descripción',
    'Unidad',
    'Cantidad solicitada',
    'Cantidad entregada',
    'Observaciones',
    'Registrado por',
    'Fecha de creación',
    'Versión',
    'Firmados de esta versión',
  ];
  sheet.addRow(columns);
  let skip = 0;
  for (;;) {
    const records = await db.solicitudBien.findMany({
      where,
      orderBy: [{ fechaSolicitud: order }, { id: order }],
      skip,
      take: 100,
      include: { adjuntos: { where: { completo: true }, select: { version: true } } },
    });
    if (!records.length) break;
    for (const r of records) {
      const data = r.datos as unknown as SolicitudBienData;
      data.items.forEach((i, n) =>
        sheet.addRow([
          r.id,
          r.fechaSolicitud,
          r.movimiento,
          r.area,
          data.head,
          data.holderType,
          data.holder,
          data.identification,
          data.destination,
          data.group,
          n + 1,
          i.code,
          i.description,
          i.unit,
          Number(i.requested),
          i.delivered === '' ? null : Number(i.delivered),
          i.observations,
          r.registradoPor,
          r.createdAt,
          r.version,
          r.adjuntos.filter((f) => f.version === r.version).length,
        ]),
      );
    }
    skip += records.length;
    if (sheet.rowCount > 100000)
      throw new HttpError(
        413,
        'Hay demasiados ítems para una sola exportación. Reduce el rango de fechas.',
      );
  }
  sheet.columns = columns.map((header, i) => ({
    header,
    width: [6, 12, 16].includes(i) ? 35 : 22,
  }));
  sheet.getColumn(2).numFmt = 'dd/mm/yyyy';
  sheet.getColumn(19).numFmt = 'dd/mm/yyyy hh:mm';
  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  sheet
    .getRow(1)
    .eachCell(
      (c) => (c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF00304D' } }),
    );
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: sheet.rowCount, column: columns.length },
  };
  const bytes = await wb.xlsx.writeBuffer();
  if (bytes.byteLength > 4 * 1024 * 1024)
    throw new HttpError(413, 'El archivo es demasiado grande. Reduce el rango de fechas.');
  return new Response(new Uint8Array(bytes), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="HISTORIAL_BIENES.xlsx"',
      'Cache-Control': 'private, no-store',
    },
  });
}

export async function handleBienes(req: Request, path: string[]) {
  try {
    const actor = await currentUser(),
      method = req.method,
      url = new URL(req.url);
    if (method !== 'GET') checkOrigin(req);
    if (path[0] === 'session' && method === 'GET')
      return Response.json({ admin: actor?.rol === 'admin', name: actor?.nombre || null });
    if (path[0] === 'recover' && method === 'POST') {
      await limit(req, 'recuperar', 90);
      const { code } = z
        .object({ code: z.string().trim().max(160) })
        .strict()
        .parse(await json(req));
      const id = parseCode(code);
      const headers = new Headers(req.headers);
      headers.set('x-bienes-code', code);
      await authorize(new Request(req.url, { headers }), id, actor);
      return Response.json(await dto(id));
    }
    if (path[0] !== 'requests') throw new HttpError(404, 'Ruta no encontrada.');
    if (path.length === 1 && method === 'GET') {
      requireAdmin(actor);
      const where = filters(url),
        total = await db.solicitudBien.count({ where }),
        pages = Math.max(1, Math.ceil(total / 8));
      const page = Math.max(
        1,
        Math.min(pages, Math.floor(Number(url.searchParams.get('page')) || 1)),
      );
      const order = url.searchParams.get('order') === 'asc' ? 'asc' : 'desc';
      const records = await db.solicitudBien.findMany({
        where,
        orderBy: [{ fechaSolicitud: order }, { id: order }],
        skip: (page - 1) * 8,
        take: 8,
        include: { adjuntos: { where: { completo: true }, select: { version: true } } },
      });
      return Response.json({
        total,
        page,
        pages,
        records: records.map((r) => {
          const d = r.datos as unknown as SolicitudBienData;
          return {
            id: r.id,
            ...d,
            items: d.items.map(() => ({})),
            origin: r.origen,
            version: r.version,
            registeredBy: r.registradoPor,
            createdAt: r.createdAt,
            attachments: r.adjuntos,
          };
        }),
      });
    }
    if (path[1] === 'export' && method === 'GET') {
      requireAdmin(actor);
      return await exportHistory(url);
    }
    if (path.length === 1 && method === 'POST') {
      const { data, key } = z
        .object({ data: solicitudBienSchema, key: z.string().uuid() })
        .strict()
        .parse(await json(req));
      if (actor?.rol !== 'admin') await limit(req, 'crear', 30);
      const initialHash = hash(JSON.stringify(data));
      let record = await db.solicitudBien.findUnique({ where: { claveCreacion: key } });
      if (!record) {
        try {
          record = await db.$transaction(
            async (tx) => {
              // El consecutivo se asigna en Postgres. El código nunca se almacena en texto plano.
              const placeholder = createHmac('sha256', secret())
                .update('pending:' + key)
                .digest('hex');
              const created = await tx.solicitudBien.create({
                data: {
                  claveCreacion: key,
                  hashInicial: initialHash,
                  tokenHash: placeholder,
                  datos: data,
                  origen: actor?.rol === 'admin' ? 'ADMIN' : 'PUBLICA',
                  registradoPor: actorName(actor),
                  autorId: actor?.id,
                  ...indiceBienes(data),
                },
              });
              const result = await tx.solicitudBien.update({
                where: { id: created.id },
                data: { tokenHash: hash(createCode(created.id, key)) },
              });
              await event(
                tx,
                result,
                actor,
                'Solicitud guardada',
                'Solicitud recibida para revisión.',
                data,
              );
              return result;
            },
            { isolationLevel: 'Serializable' },
          );
        } catch (error) {
          if (!(error && typeof error === 'object' && 'code' in error && error.code === 'P2002'))
            throw error;
          record = await db.solicitudBien.findUnique({ where: { claveCreacion: key } });
        }
      }
      if (
        !record ||
        record.deletedAt ||
        record.hashInicial !== initialHash ||
        record.tokenHash !== hash(createCode(record.id, key))
      )
        throw new HttpError(
          409,
          'La solicitud ya fue enviada con otros datos. Recupérala con su código o inicia una solicitud nueva.',
        );
      return Response.json(
        { ...(await dto(record.id)), code: createCode(record.id, key) },
        { status: 201 },
      );
    }
    const id = Number(path[1]);
    const record = await authorize(req, id, actor);
    if (path.length === 2 && method === 'GET') return Response.json(await dto(id));
    if (path.length === 2 && method === 'PATCH') {
      const { data, version } = z
        .object({ data: solicitudBienSchema, version: z.number().int().positive() })
        .strict()
        .parse(await json(req));
      await db.$transaction(
        async (tx) => {
          const updated = await tx.solicitudBien.updateMany({
            where: { id, version, deletedAt: null },
            data: { datos: data, ...indiceBienes(data), version: { increment: 1 } },
          });
          if (!updated.count)
            throw new HttpError(
              409,
              'Otro usuario modificó la solicitud. Recupérala antes de guardar.',
            );
          await event(
            tx,
            { id, version: version + 1 },
            actor,
            'Solicitud actualizada',
            'Se guardó una nueva versión. Los firmados anteriores se conservan con su versión.',
            data,
          );
        },
        { isolationLevel: 'Serializable' },
      );
      return Response.json(await dto(id));
    }
    if (path.length === 2 && method === 'DELETE') {
      requireAdmin(actor);
      const { version } = z
        .object({ version: z.number().int().positive() })
        .strict()
        .parse(await json(req));
      await db.$transaction(
        async (tx) => {
          const updated = await tx.solicitudBien.updateMany({
            where: { id, version, deletedAt: null },
            data: { deletedAt: new Date(), version: { increment: 1 } },
          });
          if (!updated.count)
            throw new HttpError(409, 'La solicitud cambió. Recarga antes de eliminar.');
          await event(
            tx,
            { id, version: version + 1 },
            actor,
            'Solicitud eliminada',
            'Retirada del historial activo; se conserva para auditoría.',
            record.datos as Prisma.InputJsonValue,
          );
        },
        { isolationLevel: 'Serializable' },
      );
      return Response.json({ ok: true });
    }
    if (path[2] === 'documents' && method === 'POST') {
      const { version, format } = z
        .object({ version: z.number().int().positive(), format: z.enum(['PDF', 'XLSX']) })
        .strict()
        .parse(await json(req));
      if (version !== record.version)
        throw new HttpError(409, 'La solicitud cambió. Recupérala antes de descargar.');
      const data = solicitudBienSchema.parse(record.datos);
      let bytes: Uint8Array;
      try {
        bytes = format === 'PDF' ? await originalPdfBytes(data) : await originalExcelBytes(data);
      } catch (error) {
        if (error instanceof Error && error.message.startsWith('El texto de'))
          throw new HttpError(422, error.message);
        throw error;
      }
      if (bytes.byteLength > 4 * 1024 * 1024)
        throw new HttpError(
          413,
          'El documento es demasiado grande. Reduce el número de ítems de esta solicitud.',
        );
      await db.$transaction(
        async (tx) => {
          const current = await tx.solicitudBien.findUnique({
            where: { id },
            select: { version: true, deletedAt: true },
          });
          if (!current || current.deletedAt || current.version !== version)
            throw new HttpError(
              409,
              'La solicitud cambió durante la generación. Recupérala antes de descargar.',
            );
          await event(tx, record, actor, 'Documento generado para descarga', `Formato ${format}.`);
        },
        { isolationLevel: 'Serializable' },
      );
      const name =
        normalizarBienes(data.holder)
          .replace(/[^a-z0-9]+/g, '_')
          .slice(0, 90) || 'cuentadante';
      const filename = `GIL-F-014_${data.date}_${name}.${format === 'PDF' ? 'pdf' : 'xlsx'}`;
      return new Response(new Uint8Array(bytes), {
        headers: {
          'Content-Type':
            format === 'PDF'
              ? 'application/pdf'
              : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Cache-Control': 'private, no-store',
        },
      });
    }
    if (path[2] === 'attachments') return await handleAttachment(req, path, record, actor);
    throw new HttpError(405, 'Acción no disponible.');
  } catch (error) {
    if (error instanceof z.ZodError)
      return Response.json(
        {
          error:
            'Revisa los datos de la solicitud: ' +
            error.issues
              .slice(0, 4)
              .map((issue) => issue.message)
              .join(' '),
        },
        { status: 400 },
      );
    return apiError(error);
  }
}

async function handleAttachment(req: Request, path: string[], record: SolicitudBien, actor: Actor) {
  const id = record.id,
    method = req.method;
  if (path.length === 3 && method === 'POST') {
    if (actor?.rol !== 'admin') await limit(req, 'adjuntar', 60);
    const input = z
      .object({
        version: z.number().int().positive(),
        name: z
          .string()
          .trim()
          .min(1)
          .max(180)
          .refine((v) => !/[/\\\x00-\x1f]/.test(v)),
        size: z.number().int().positive().max(MAX_FILE),
        sha256: z.string().regex(/^[a-f0-9]{64}$/),
        type: z.enum(['application/pdf', 'image/jpeg', 'image/png']),
      })
      .strict()
      .parse(await json(req));
    if (input.version !== record.version)
      throw new HttpError(409, 'La solicitud cambió. Recupérala antes de adjuntar.');
    if (!(
      (input.type === 'application/pdf' && /\.pdf$/i.test(input.name)) ||
      (input.type === 'image/png' && /\.png$/i.test(input.name)) ||
      (input.type === 'image/jpeg' && /\.jpe?g$/i.test(input.name))
    ))
      throw new HttpError(400, 'El nombre y el tipo de archivo no coinciden.');
    const upload = await db.$transaction(
      async (tx) => {
        const current = await tx.solicitudBien.findUnique({ where: { id } });
        if (!current || current.deletedAt || current.version !== input.version)
          throw new HttpError(409, 'La solicitud cambió. Recupérala antes de adjuntar.');
        await tx.solicitudBienAdjunto.deleteMany({
          where: { completo: false, createdAt: { lt: new Date(Date.now() - 86400000) } },
        });
        const existing = await tx.solicitudBienAdjunto.findFirst({
          where: { solicitudId: id, version: input.version, sha256: input.sha256 },
        });
        if (existing) {
          if (existing.completo)
            throw new HttpError(409, 'Este archivo ya está adjunto a esa versión.');
          return existing;
        }
        if (
          (await tx.solicitudBienAdjunto.count({
            where: { solicitudId: id, version: input.version },
          })) >= 5
        )
          throw new HttpError(409, 'Esta versión ya tiene cinco archivos o cargas en curso.');
        const used = await tx.solicitudBienAdjunto.aggregate({ _sum: { size: true } });
        const budget = (Number(process.env.BIENES_STORAGE_LIMIT_MB) || 256) * 1024 * 1024;
        if ((used._sum.size || 0) + input.size > budget)
          throw new HttpError(
            409,
            'El almacenamiento de firmados está lleno. Contacta al administrador.',
          );
        return tx.solicitudBienAdjunto.create({
          data: {
            solicitudId: id,
            version: input.version,
            nombre: input.name,
            tipo: input.type,
            size: input.size,
            sha256: input.sha256,
            actor: actorName(actor),
            autorId: actor?.id,
          },
        });
      },
      { isolationLevel: 'Serializable' },
    );
    return Response.json({ id: upload.id, chunkSize: CHUNK_SIZE });
  }
  const file = await db.solicitudBienAdjunto.findFirst({
    where: { id: path[3] || '', solicitudId: id },
  });
  if (!file) throw new HttpError(404, 'Archivo no encontrado.');
  if (path[4] === 'chunks') {
    const index = Number(path[5]);
    if (!Number.isInteger(index) || index < 0 || index >= Math.ceil(file.size / CHUNK_SIZE))
      throw new HttpError(404, 'Parte no encontrada.');
    if (method === 'PUT') {
      if (file.completo) throw new HttpError(409, 'El archivo ya está finalizado.');
      if (file.version !== record.version)
        throw new HttpError(409, 'La solicitud cambió durante la carga.');
      const bytes = await readBytes(req, CHUNK_SIZE),
        expected = Math.min(CHUNK_SIZE, file.size - index * CHUNK_SIZE);
      if (bytes.length !== expected)
        throw new HttpError(400, 'El tamaño de la parte es incorrecto.');
      await db.$transaction(
        async (tx) => {
          const current = await tx.solicitudBien.findUnique({ where: { id } });
          const upload = await tx.solicitudBienAdjunto.findUnique({ where: { id: file.id } });
          if (
            !current ||
            current.deletedAt ||
            current.version !== file.version ||
            !upload ||
            upload.completo
          )
            throw new HttpError(409, 'La solicitud cambió o el archivo ya está finalizado.');
          await tx.solicitudBienParte.upsert({
            where: { adjuntoId_indice: { adjuntoId: file.id, indice: index } },
            create: { adjuntoId: file.id, indice: index, datos: bytes },
            update: { datos: bytes },
          });
        },
        { isolationLevel: 'Serializable' },
      );
      return Response.json({ ok: true });
    }
    if (method === 'GET' && file.completo) {
      const part = await db.solicitudBienParte.findUnique({
        where: { adjuntoId_indice: { adjuntoId: file.id, indice: index } },
      });
      if (!part) throw new HttpError(404, 'Parte no encontrada.');
      return new Response(new Uint8Array(part.datos), {
        headers: {
          'Content-Type': 'application/octet-stream',
          'Cache-Control': 'private, no-store',
          'X-Content-Type-Options': 'nosniff',
        },
      });
    }
  }
  if (path[4] === 'finish' && method === 'POST') {
    await db.$transaction(
      async (tx) => {
        const current = await tx.solicitudBien.findUnique({
          where: { id },
          select: { version: true, deletedAt: true },
        });
        if (!current || current.deletedAt || current.version !== file.version)
          throw new HttpError(409, 'La solicitud cambió. Recupérala antes de adjuntar.');
        const upload = await tx.solicitudBienAdjunto.findUniqueOrThrow({ where: { id: file.id } });
        if (upload.completo) return;
        const parts = await tx.solicitudBienParte.findMany({
          where: { adjuntoId: file.id },
          orderBy: { indice: 'asc' },
        });
        if (
          parts.length !== Math.ceil(file.size / CHUNK_SIZE) ||
          parts.some((p, i) => p.indice !== i)
        )
          throw new HttpError(400, 'La carga está incompleta. Vuelve a intentarlo.');
        const bytes = Buffer.concat(parts.map((part) => Buffer.from(part.datos)));
        if (bytes.length !== file.size || hash(bytes) !== file.sha256)
          throw new HttpError(400, 'El archivo no superó la comprobación de integridad.');
        const valid =
          (file.tipo === 'application/pdf' && bytes.subarray(0, 5).toString() === '%PDF-') ||
          (file.tipo === 'image/png' &&
            bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) ||
          (file.tipo === 'image/jpeg' && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255);
        if (!valid)
          throw new HttpError(400, 'El contenido no corresponde a un PDF, JPG o PNG válido.');
        await tx.solicitudBienAdjunto.update({
          where: { id: file.id },
          data: { completo: true, finalizadoAt: new Date() },
        });
        await event(
          tx,
          { id, version: file.version },
          actor,
          'Documento firmado adjuntado',
          file.nombre,
        );
      },
      { isolationLevel: 'Serializable', timeout: 30000 },
    );
    return Response.json(await dto(id));
  }
  if (path[4] === 'download' && method === 'POST' && file.completo) {
    await db.$transaction(async (tx) => {
      await event(
        tx,
        { id, version: file.version },
        actor,
        'Documento firmado solicitado',
        file.nombre,
      );
    });
    return Response.json({
      id: file.id,
      name: file.nombre,
      size: file.size,
      type: file.tipo,
      sha256: file.sha256,
      chunkSize: CHUNK_SIZE,
    });
  }
  if (path.length === 4 && method === 'DELETE' && !file.completo) {
    await db.solicitudBienAdjunto.deleteMany({ where: { id: file.id, completo: false } });
    return Response.json({ ok: true });
  }
  throw new HttpError(405, 'Acción no disponible.');
}
