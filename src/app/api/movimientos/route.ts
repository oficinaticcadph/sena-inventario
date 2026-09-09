import { db } from '@/lib/db';
import { apiError, requireUser, checkOrigin, body, HttpError } from '@/lib/access';
import { z } from 'zod';
export async function POST(req: Request) {
  try {
    checkOrigin(req);
    const user = await requireUser(true);
    const parsed = z
      .object({ equipoId: z.string(), detalle: z.string().trim().min(4).max(1000) })
      .strict()
      .parse(await body(req));
    if (!(await db.equipo.findUnique({ where: { id: parsed.equipoId }, select: { id: true } })))
      throw new HttpError(404, 'Equipo no encontrado.');
    await db.movimiento.create({ data: { ...parsed, tipo: 'edicion', autorId: user.id } });
    return Response.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
