import { db } from '@/lib/db';
import { apiError, requireUser, checkOrigin, body } from '@/lib/access';
import { equipoSchema } from '@/lib/validation';
import { normalizePlate } from '@/lib/fields';
export async function GET(req: Request) {
  try {
    const q = normalizePlate(new URL(req.url).searchParams.get('q') || '').slice(0, 80);
    if (!q) return Response.json([]);
    const rows = await db.equipo.findMany({
      where: { placaSena: { contains: q, mode: 'insensitive' } },
      take: 8,
      orderBy: { placaSena: 'asc' },
      select: { id: true, placaSena: true, componente: true, marca: true, activo: true },
    });
    return Response.json(rows);
  } catch (e) {
    return apiError(e);
  }
}
export async function POST(req: Request) {
  try {
    checkOrigin(req);
    const user = await requireUser(true);
    const parsed = equipoSchema.parse(await body(req));
    const { nombreUsuario, contacto, ...data } = parsed;
    const created = await db.equipo.create({
      data: {
        ...data,
        cuentadante: nombreUsuario
          ? { create: { nombre: nombreUsuario, contacto, sede: String(data.sede || '') } }
          : undefined,
        movimientos: {
          create: { tipo: 'alta', autorId: user.id, detalle: 'Equipo registrado manualmente.' },
        },
      },
    });
    return Response.json({ id: created.id }, { status: 201 });
  } catch (e) {
    return apiError(e);
  }
}
