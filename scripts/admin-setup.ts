import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';
import { emitKeypressEvents } from 'node:readline';
import { passwordSchema } from '../src/lib/validation';
try {
  process.loadEnvFile('.env');
} catch {}
async function secret(prompt: string): Promise<string> {
  if (!process.stdin.isTTY) throw new Error('Ejecuta este script en una terminal interactiva.');
  process.stdout.write(prompt);
  emitKeypressEvents(process.stdin);
  process.stdin.setRawMode(true);
  process.stdin.resume();
  return new Promise((resolve, reject) => {
    let value = '';
    const listener = (str: string, key: { name: string; ctrl: boolean }) => {
      if (key.ctrl && key.name === 'c') {
        finish();
        reject(new Error('Cancelado'));
      } else if (key.name === 'return') {
        finish();
        resolve(value);
      } else if (key.name === 'backspace') value = value.slice(0, -1);
      else if (str && !key.ctrl) value += str;
    };
    const finish = () => {
      process.stdin.off('keypress', listener);
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdout.write('\n');
    };
    process.stdin.on('keypress', listener);
  });
}
const password = passwordSchema.parse(
  await secret('Nueva contraseña (mínimo 12 caracteres, entrada oculta): '),
);
if (password !== (await secret('Repite la contraseña: ')))
  throw new Error('Las contraseñas no coinciden.');
const db = new PrismaClient();
try {
  const usuario = process.env.SEED_ADMIN_USER || 'jucsendoya';
  await db.administrador.upsert({
    where: { usuario },
    create: { usuario, nombre: usuario, rol: 'admin', passwordHash: await hash(password, 12) },
    update: { passwordHash: await hash(password, 12), sessionVersion: { increment: 1 } },
  });
  console.log(`Contraseña configurada para ${usuario}.`);
} finally {
  await db.$disconnect();
}
