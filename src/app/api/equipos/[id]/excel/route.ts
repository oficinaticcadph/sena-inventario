import { db } from '@/lib/db';
import { apiError, requireUser, checkOrigin, body, HttpError } from '@/lib/access';
import { generateWorkbook, templatePath } from '@/lib/template';
import { preserveDrawings } from '@/lib/ooxml';
import { equipmentData } from '@/lib/equipment';
import { coreFields, manualFields, isMissing, maskPII, type Ficha } from '@/lib/fields';
import { readFile } from 'node:fs/promises';
import { z } from 'zod';
export const runtime = 'nodejs';
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    checkOrigin(req);
    const user = await requireUser();
    const { id } = await params;
    const input = z
      .object({
        version: z.number().int(),
        campos: z.record(z.string(), z.string().max(500)).default({}),
      })
      .strict()
      .parse(await body(req));
    const e = await db.equipo.findUnique({ where: { id }, include: { cuentadante: true } });
    if (!e) throw new HttpError(404, 'Equipo no encontrado.');
    if (e.version !== input.version)
      throw new HttpError(409, 'El equipo cambió. Recarga la ficha antes de generar.');
    const mapped = equipmentData(e, user.rol);
    const data: Ficha = { ...mapped.ficha };
    for (const key of ['placaSena', 'nombreUsuario', ...Object.keys(coreFields)])
      data[key] = String(mapped[key as keyof typeof mapped] || '');
    for (const [key, value] of Object.entries(input.campos)) {
      if (
        Object.hasOwn(manualFields, key) ||
        key === 'hostname' ||
        ((Object.hasOwn(coreFields, key) || key === 'nombreUsuario') && isMissing(data[key]))
      )
        data[key] = value;
      else
        throw new HttpError(
          400,
          'Solo se pueden completar campos manuales o vacíos para este reporte.',
        );
    }
    if (user.rol === 'consulta') data.nombreUsuario = maskPII(data.nombreUsuario);
    const workbook = await generateWorkbook(data, e.grupo, user.nombre);
    const output = await preserveDrawings(
      await readFile(templatePath),
      Buffer.from(await workbook.xlsx.writeBuffer()),
    );
    // System-generated audit records are allowed for consulta; manual movement creation is admin-only.
    await db.$transaction(
      async (tx) => {
        const current = await tx.equipo.findUnique({ where: { id }, select: { version: true } });
        if (current?.version !== e.version)
          throw new HttpError(409, 'El equipo cambió durante la generación. Vuelve a intentarlo.');
        await tx.movimiento.create({
          data: {
            equipoId: id,
            autorId: user.id,
            tipo: 'generacion',
            detalle: 'Hoja de vida GTI-F-132 generada.',
            cambios: { version: e.version, camposReporte: input.campos },
          },
        });
      },
      { isolationLevel: 'Serializable' },
    );
    const filename = `HOJA_DE_VIDA_${e.placaSena.replace(/[^a-zA-Z0-9_-]/g, '_')}.xlsx`;
    return new Response(new Uint8Array(output), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (e) {
    return apiError(e);
  }
}
