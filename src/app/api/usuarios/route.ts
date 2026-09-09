import { db } from '@/lib/db';
import { hash } from 'bcryptjs';
import { apiError, requireUser, checkOrigin, body, HttpError } from '@/lib/access';
import { usuarioSchema } from '@/lib/validation';
import { z } from 'zod';
export async function POST(req: Request) {
  try {
    checkOrigin(req);
    const actor = await requireUser(true);
    const { password, ...data } = usuarioSchema.parse(await body(req));
    const passwordHash = await hash(password, 12);
    await db.$transaction(async (tx) => {
      const user = await tx.administrador.create({ data: { ...data, passwordHash } });
      await tx.eventoUsuario.create({
        data: {
          autorId: actor.id,
          destinoId: user.id,
          detalle: `Usuario creado con rol ${data.rol}.`,
        },
      });
    });
    return Response.json({ ok: true }, { status: 201 });
  } catch (e) {
    return apiError(e);
  }
}
export async function PATCH(req: Request) {
  try {
    checkOrigin(req);
    const actor = await requireUser(true);
    const { id, activo } = z
      .object({ id: z.string(), activo: z.boolean() })
      .strict()
      .parse(await body(req));
    if (id === actor.id) throw new HttpError(400, 'No puedes desactivar tu propia cuenta.');
    await db.$transaction(
      async (tx) => {
        const user = await tx.administrador.findUnique({ where: { id } });
        if (!user) throw new HttpError(404, 'Usuario no encontrado.');
        if (
          !activo &&
          user.rol === 'admin' &&
          (await tx.administrador.count({ where: { rol: 'admin', activo: true } })) <= 1
        )
          throw new HttpError(409, 'Debe existir al menos un administrador activo.');
        await tx.administrador.update({
          where: { id },
          data: { activo, sessionVersion: { increment: 1 } },
        });
        await tx.eventoUsuario.create({
          data: {
            autorId: actor.id,
            destinoId: id,
            detalle: activo ? 'Usuario activado.' : 'Usuario desactivado; sesiones revocadas.',
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
