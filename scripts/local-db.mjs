import EmbeddedPostgres from 'embedded-postgres';
import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
await mkdir('private', { recursive: true });
if (!existsSync('.env')) {
  const password = randomBytes(24).toString('hex');
  const url = `postgresql://postgres:${password}@127.0.0.1:55432/sena?schema=public`;
  await writeFile(
    '.env',
    `DATABASE_URL="${url}"\nDIRECT_URL="${url}"\nNEXTAUTH_URL="http://localhost:3000"\nNEXTAUTH_SECRET="${randomBytes(32).toString('hex')}"\nSEED_ADMIN_USER="jucsendoya"\n`,
    { mode: 0o600 },
  );
}
process.loadEnvFile('.env');
const url = new URL(process.env.DATABASE_URL);
if (!['127.0.0.1', 'localhost'].includes(url.hostname) || url.port !== '55432')
  throw new Error('Este script solo administra Postgres local en el puerto 55432.');
const pg = new EmbeddedPostgres({
  databaseDir: path.resolve('private/postgres'),
  user: decodeURIComponent(url.username),
  password: decodeURIComponent(url.password),
  port: 55432,
  persistent: true,
  authMethod: 'scram-sha-256',
  postgresFlags: ['-h', '127.0.0.1'],
  onLog: () => {},
  onError: (message) => {
    if (String(message).includes('FATAL')) console.error(String(message));
  },
});
if (!existsSync('private/postgres/PG_VERSION')) await pg.initialise();
await pg.start();
const client = pg.getPgClient();
await client.connect();
const result = await client.query("SELECT 1 FROM pg_database WHERE datname='sena'");
if (!result.rowCount) await pg.createDatabase('sena');
await client.end();
console.log('Postgres local listo en 127.0.0.1:55432. Datos persistentes en private/postgres.');
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  await pg.stop();
  process.exit(0);
}
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
setInterval(() => {}, 60000);
