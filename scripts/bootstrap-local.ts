import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { writeFile, mkdir } from 'node:fs/promises';
process.loadEnvFile('.env');
if (!process.env.DATABASE_URL?.includes('127.0.0.1:55432'))
  throw new Error('Solo se permite en la base local.');
const db = new PrismaClient();
try {
  const usuario = process.env.SEED_ADMIN_USER || 'jucsendoya';
  if (!(await db.administrador.findUnique({ where: { usuario } }))) {
    const password = randomBytes(18).toString('base64url');
    await db.administrador.create({
      data: { usuario, nombre: 'jucsendoya', rol: 'admin', passwordHash: await hash(password, 12) },
    });
    await mkdir('private', { recursive: true });
    await writeFile(
      'private/acceso-inicial.txt',
      `Acceso local SENA\nURL: http://localhost:3000\nUsuario: ${usuario}\nContraseña temporal: ${password}\n\nCambia esta contraseña ejecutando npm run admin:setup en una terminal.\nEste archivo es privado y está excluido del repositorio.\n`,
      { mode: 0o600 },
    );
    console.log('Administrador local creado. Credenciales en private/acceso-inicial.txt.');
  } else console.log('El administrador ya existe. No se modificaron sus credenciales.');
} finally {
  await db.$disconnect();
}
