import { db } from '@/lib/db';
import { apiError, requireUser, checkOrigin, body, HttpError } from '@/lib/access';
import { editSchema } from '@/lib/validation';
import { equipmentData } from '@/lib/equipment';
import { z } from 'zod';
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    checkOrigin(req);
    const user = await requireUser(true);
    const { id } = await params;
    const { datos, version, detalle } = editSchema.parse(await body(req));
    await db.$transaction(
      async (tx) => {
        const previous = await tx.equipo.findUnique({
          where: { id },
          include: { cuentadante: true },
        });
        if (!previous) throw new HttpError(404, 'Equipo no encontrado.');
        if (!previous.activo) throw new HttpError(409, 'El equipo está dado de baja.');
        const { nombreUsuario, contacto, ...data } = datos;
        const changedUser = (previous.cuentadante?.nombre || '') !== nombreUsuario;
        let cuentadanteId = previous.cuentadanteId;
        if (
          changedUser ||
          contacto !== (previous.cuentadante?.contacto || '') ||
          data.sede !== previous.sede
        ) {
          cuentadanteId = nombreUsuario
            ? (
                await tx.cuentadante.create({
                  data: { nombre: nombreUsuario, contacto, sede: String(data.sede || '') },
                })
              ).id
            : null;
        }
        const update = await tx.equipo.updateMany({
          where: { id, version },
          data: { ...data, cuentadanteId, version: { increment: 1 } },
        });
        if (!update.count)
          throw new HttpError(
            409,
            'Otro administrador modificó este equipo. Recarga antes de guardar.',
          );
        const tipo = changedUser
          ? nombreUsuario
            ? previous.cuentadanteId
              ? 'reasignacion'
              : 'asignacion'
            : 'devolucion'
          : 'edicion';
        await tx.movimiento.create({
          data: {
            equipoId: id,
            autorId: user.id,
            tipo,
            detalle,
            cambios: { antes: equipmentData(previous, 'admin'), despues: datos },
          },
        });
      },
      { isolationLevel: 'Serializable' },
    );
    return Response.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    checkOrigin(req);
    const user = await requireUser(true);
    const { id } = await params;
    const data = z
      .object({ version: z.number().int(), detalle: z.string().trim().min(4).max(1000) })
      .parse(await body(req));
    await db.$transaction(async (tx) => {
      const result = await tx.equipo.updateMany({
        where: { id, version: data.version, activo: true },
        data: { activo: false, version: { increment: 1 } },
      });
      if (!result.count) throw new HttpError(409, 'El equipo cambió o ya está dado de baja.');
      await tx.movimiento.create({
        data: { equipoId: id, autorId: user.id, tipo: 'baja', detalle: data.detalle },
      });
    });
    return Response.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
