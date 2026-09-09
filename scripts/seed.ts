import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { readInventory } from '../src/lib/import-inventory';
try {
  process.loadEnvFile('.env');
} catch {}
const db = new PrismaClient();
try {
  const input = process.env.INVENTORY_PATH || process.argv[2];
  if (!input) throw new Error('Configura INVENTORY_PATH.');
  const username = (process.env.SEED_ADMIN_USER || 'jucsendoya').toLowerCase();
  let admin = await db.administrador.findUnique({ where: { usuario: username } });
  if (!admin) {
    const password = process.env.SEED_ADMIN_PASSWORD;
    if (!password || password.length < 12 || Buffer.byteLength(password) > 72)
      throw new Error(
        'Configura SEED_ADMIN_PASSWORD (mínimo 12 caracteres, máximo 72 bytes) o ejecuta npm run admin:setup.',
      );
    admin = await db.administrador.create({
      data: {
        usuario: username,
        nombre: username,
        rol: 'admin',
        passwordHash: await hash(password, 12),
      },
    });
  }
  if (!admin.activo || admin.rol !== 'admin')
    throw new Error('El usuario de importación debe ser administrador activo.');
  const checksum = createHash('sha256')
    .update(await readFile(input))
    .digest('hex');
  if (await db.importacion.findUnique({ where: { hash: checksum } })) {
    const result = await readInventory(input);
    await db.incidenciaImportacion.createMany({
      data: result.quarantine.map((row) => ({
        hash: checksum,
        grupo: row.grupo,
        fila: row.sourceRow,
        placaSena: row.placaSena,
        datos: JSON.parse(JSON.stringify(row)),
      })),
      skipDuplicates: true,
    });
    console.log(
      'Este inventario ya fue importado. No se modificaron los equipos; incidencias conservadas en base de datos.',
    );
  } else {
    const result = await readInventory(input);
    await mkdir('private', { recursive: true });
    await writeFile(
      'private/importacion-incidencias.json',
      JSON.stringify({ resumen: result.summary, incidencias: result.issues }, null, 2),
    );
    await writeFile(
      'private/importacion-cuarentena.json',
      JSON.stringify(result.quarantine, null, 2),
    );
    if (result.issues.length && !process.argv.includes('--allow-quarantine'))
      throw new Error(
        `${result.issues.length} incidencias. Revisa private/importacion-incidencias.json. --allow-quarantine conserva filas problemáticas en cuarentena y carga solo placas únicas válidas.`,
      );
    let inserted = 0,
      existing = 0;
    await db.$transaction(
      async (tx) => {
        for (const row of result.rows) {
          if (
            await tx.equipo.findUnique({
              where: { placaSena: row.placaSena },
              select: { id: true },
            })
          ) {
            existing++;
            continue;
          }
          const { nombre, contacto, sourceRow, ...data } = row;
          await tx.equipo.create({
            data: {
              ...data,
              origen: { ...row.origen, _hoja: row.grupo, _fila: String(sourceRow) },
              cuentadante: nombre ? { create: { nombre, contacto, sede: row.sede } } : undefined,
              movimientos: {
                create: {
                  tipo: 'alta',
                  autorId: admin!.id,
                  detalle: `Carga inicial desde ${row.grupo}, fila ${sourceRow}.`,
                },
              },
            },
          });
          inserted++;
        }
        await tx.importacion.create({
          data: {
            hash: checksum,
            archivo: 'INVENTARIO SENA 2026.xlsx',
            resumen: {
              porHoja: result.summary,
              insertados: inserted,
              existentes: existing,
              incidencias: result.issues.length,
              filasEnCuarentena: result.quarantine.length,
            },
          },
        });
        await tx.incidenciaImportacion.createMany({
          data: result.quarantine.map((row) => ({
            hash: checksum,
            grupo: row.grupo,
            fila: row.sourceRow,
            placaSena: row.placaSena,
            datos: JSON.parse(JSON.stringify(row)),
          })),
          skipDuplicates: true,
        });
      },
      { timeout: 120000 },
    );
    console.log(
      JSON.stringify({
        insertados: inserted,
        existentes: existing,
        incidencias: result.issues.length,
        porHoja: result.summary,
      }),
    );
  }
} finally {
  await db.$disconnect();
}
