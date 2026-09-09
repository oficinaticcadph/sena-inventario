import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from './auth';
import { db } from './db';
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export async function currentUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;
  const user = await db.administrador.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      usuario: true,
      nombre: true,
      rol: true,
      activo: true,
      sessionVersion: true,
    },
  });
  return user?.activo && user.sessionVersion === session.user.version ? user : null;
}
export async function requireUser(admin = false) {
  const user = await currentUser();
  if (!user) throw new HttpError(401, 'Debes iniciar sesión.');
  if (admin && user.rol !== 'admin')
    throw new HttpError(403, 'Esta acción requiere un administrador.');
  return user;
}
export async function pageUser(admin = false) {
  const user = await currentUser();
  if (!user) redirect('/login');
  if (admin && user.rol !== 'admin') redirect('/');
  return user;
}
export function checkOrigin(req: Request) {
  const origin = req.headers.get('origin');
  const configured = new URL(process.env.NEXTAUTH_URL || req.url);
  const allowed = new Set([configured.origin]);
  if (configured.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(configured.hostname)) {
    const local = new URL(configured);
    local.hostname = configured.hostname === 'localhost' ? '127.0.0.1' : 'localhost';
    allowed.add(local.origin);
  }
  if (!origin || !allowed.has(origin))
    throw new HttpError(403, 'Origen de solicitud no permitido.');
}
export async function body(req: Request) {
  if (Number(req.headers.get('content-length') || 0) > 32000)
    throw new HttpError(413, 'Solicitud demasiado grande.');
  const text = await req.text();
  if (text.length > 32000) throw new HttpError(413, 'Solicitud demasiado grande.');
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(400, 'Datos inválidos.');
  }
}
export function apiError(e: unknown) {
  if (e instanceof HttpError) return Response.json({ error: e.message }, { status: e.status });
  if (e && typeof e === 'object' && 'issues' in e)
    return Response.json(
      { error: 'Revisa los campos obligatorios y sus longitudes.' },
      { status: 400 },
    );
  if (e && typeof e === 'object' && 'code' in e && e.code === 'P2002')
    return Response.json({ error: 'La placa o el usuario ya existe.' }, { status: 409 });
  if (e && typeof e === 'object' && 'code' in e && e.code === 'P2034')
    return Response.json(
      { error: 'Otro administrador actualizó el registro. Recarga e inténtalo de nuevo.' },
      { status: 409 },
    );
  console.error('Error interno', e instanceof Error ? e.name : 'unknown');
  return Response.json(
    { error: 'No fue posible completar la operación. Comprueba la conexión a la base de datos.' },
    { status: 500 },
  );
}
