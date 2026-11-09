import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { randomUUID, createHash } from 'node:crypto';
import { hash } from 'bcryptjs';
import { PDFDocument } from 'pdf-lib';
import ExcelJS from 'exceljs';
process.loadEnvFile('.env');
if (!process.env.DATABASE_URL?.includes('127.0.0.1:55432')) throw new Error('Solo base local.');
const db = new PrismaClient(),
  base = 'http://127.0.0.1:3004';
const prefix = 'qa_bienes_' + randomUUID().slice(0, 8),
  password = randomUUID();
const ids: number[] = [];
let checks = 0;
class Client {
  jar = new Map<string, string>();
  code = '';
  async request(
    path: string,
    method = 'GET',
    data?: unknown,
    opts: { origin?: string; raw?: boolean } = {},
  ) {
    const response = await fetch(base + path, {
      method,
      redirect: 'manual',
      headers: {
        Cookie: [...this.jar].map(([k, v]) => `${k}=${v}`).join('; '),
        Origin: opts.origin || base,
        ...(this.code ? { 'x-bienes-code': this.code } : {}),
        ...(data !== undefined
          ? { 'Content-Type': opts.raw ? 'application/octet-stream' : 'application/json' }
          : {}),
      },
      body:
        data === undefined
          ? undefined
          : opts.raw
            ? (data as Uint8Array<ArrayBuffer>)
            : JSON.stringify(data),
    });
    for (const cookie of response.headers.getSetCookie()) {
      const part = cookie.split(';')[0],
        at = part.indexOf('=');
      this.jar.set(part.slice(0, at), part.slice(at + 1));
    }
    return response;
  }
  async login(usuario: string) {
    const csrf = await (await this.request('/api/auth/csrf')).json();
    const response = await fetch(base + '/api/auth/callback/credentials', {
      method: 'POST',
      redirect: 'manual',
      headers: {
        Cookie: [...this.jar].map(([k, v]) => `${k}=${v}`).join('; '),
        'Content-Type': 'application/x-www-form-urlencoded',
        Origin: base,
      },
      body: new URLSearchParams({
        csrfToken: csrf.csrfToken,
        usuario,
        password,
        callbackUrl: base,
        json: 'true',
      }),
    });
    for (const cookie of response.headers.getSetCookie()) {
      const p = cookie.split(';')[0],
        at = p.indexOf('=');
      this.jar.set(p.slice(0, at), p.slice(at + 1));
    }
    assert.ok((await (await this.request('/api/auth/session')).json()).user?.id);
    checks++;
  }
}
async function status(r: Response, expected: number) {
  assert.equal(r.status, expected, r.status === expected ? '' : await r.text());
  checks++;
  return r;
}
const data = {
  movement: 'SALIDA',
  date: '2026-11-09',
  area: prefix,
  head: 'Coordinación',
  holderType: 'UNIPERSONAL',
  holder: prefix,
  identification: '00123',
  destination: 'Área administrativa',
  group: '',
  classification: 'Pública',
  authorizer: '',
  position: '',
  signature: '',
  members: [],
  items: [
    {
      code: '000123',
      description: 'Computador',
      unit: 'UN',
      requested: '1',
      delivered: '0',
      observations: '',
    },
  ],
};
const anon = new Client(),
  admin = new Client(),
  consulta = new Client();
const route = (id: number) => '/api/bienes/requests/' + id;
try {
  const passwordHash = await hash(password, 12);
  for (const rol of ['admin', 'consulta'] as const) {
    await db.administrador.create({
      data: { usuario: prefix + '_' + rol, nombre: prefix, rol, passwordHash },
    });
  }
  await admin.login(prefix + '_admin');
  await consulta.login(prefix + '_consulta');
  await status(await anon.request('/bienes'), 200);
  const frame = await status(await anon.request('/bienes/formulario.html'), 200);
  assert.equal(frame.headers.get('x-frame-options'), 'SAMEORIGIN');
  checks++;
  assert.equal((await (await anon.request('/api/bienes/session')).json()).admin, false);
  checks++;
  await status(await anon.request('/api/bienes/requests'), 401);
  await status(await consulta.request('/api/bienes/requests'), 403);
  await status(
    await anon.request(
      '/api/bienes/requests',
      'POST',
      { data, key: randomUUID() },
      { origin: 'https://malicioso.example' },
    ),
    403,
  );
  await status(
    await anon.request('/api/bienes/requests', 'POST', {
      data: { ...data, items: [] },
      key: randomUUID(),
    }),
    400,
  );
  const key = randomUUID();
  const record = await (
    await status(await anon.request('/api/bienes/requests', 'POST', { data, key }), 201)
  ).json();
  ids.push(record.id);
  anon.code = record.code;
  assert.ok(/^CADPH-\d+-/.test(record.code));
  checks++;
  assert.equal(record.events.length, 1);
  checks++;
  const again = await (
    await status(await anon.request('/api/bienes/requests', 'POST', { data, key }), 201)
  ).json();
  assert.equal(again.id, record.id);
  assert.equal(again.events.length, 1);
  checks += 2;
  await status(
    await anon.request('/api/bienes/requests', 'POST', {
      data: { ...data, holder: 'Diferente' },
      key,
    }),
    409,
  );
  await status(await new Client().request(route(record.id)), 404);
  await status(await consulta.request(route(record.id)), 404);
  await status(await admin.request(route(record.id)), 200);
  const recovered = await (
    await status(await anon.request('/api/bienes/recover', 'POST', { code: record.code }), 200)
  ).json();
  assert.equal(recovered.tokenHash, undefined);
  assert.equal(recovered.claveCreacion, undefined);
  checks += 2;
  await status(
    await anon.request(route(record.id) + '/documents', 'POST', { version: 2, format: 'PDF' }),
    409,
  );
  await status(
    await anon.request(route(record.id) + '/documents', 'POST', {
      version: 1,
      format: 'PDF',
      data,
    }),
    400,
  );
  const pdfResponse = await status(
    await anon.request(route(record.id) + '/documents', 'POST', { version: 1, format: 'PDF' }),
    200,
  );
  const pdfBytes = Buffer.from(await pdfResponse.arrayBuffer());
  const pdf = await PDFDocument.load(pdfBytes);
  assert.equal(pdf.getPageCount(), 1);
  assert.equal(pdf.getPage(0).getWidth(), 612);
  checks += 2;
  const xlsx = await status(
    await anon.request(route(record.id) + '/documents', 'POST', { version: 1, format: 'XLSX' }),
    200,
  );
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Buffer.from(await xlsx.arrayBuffer()) as unknown as ExcelJS.Buffer);
  assert.equal(workbook.getWorksheet('FORMATO GIL-F-014')?.getCell('H15').value, prefix);
  checks++;
  await status(await anon.request(route(record.id), 'DELETE', { version: 1 }), 401);
  const updated = await (
    await status(
      await anon.request(route(record.id), 'PATCH', {
        version: 1,
        data: { ...data, movement: 'INGRESO' },
      }),
      200,
    )
  ).json();
  assert.equal(updated.version, 2);
  checks++;
  await status(await anon.request(route(record.id), 'PATCH', { version: 1, data }), 409);
  const blob = Buffer.alloc(5 * 1024 * 1024, 32);
  pdfBytes.copy(blob);
  const digest = createHash('sha256').update(blob).digest('hex');
  const meta = {
    version: 2,
    name: 'firmado.pdf',
    size: blob.length,
    sha256: digest,
    type: 'application/pdf',
  };
  await status(
    await anon.request(route(record.id) + '/attachments', 'POST', {
      ...meta,
      size: 11 * 1024 * 1024,
    }),
    400,
  );
  await status(
    await anon.request(route(record.id) + '/attachments', 'POST', {
      ...meta,
      name: 'peligroso.exe',
    }),
    400,
  );
  const file = await (
    await status(await anon.request(route(record.id) + '/attachments', 'POST', meta), 200)
  ).json();
  const fileRoute = route(record.id) + '/attachments/' + file.id;
  await status(
    await anon.request(fileRoute + '/chunks/0', 'PUT', Buffer.alloc(3), { raw: true }),
    400,
  );
  await status(await anon.request(fileRoute + '/finish', 'POST', {}), 400);
  for (let start = 0, index = 0; start < blob.length; start += file.chunkSize, index++)
    await status(
      await anon.request(
        fileRoute + '/chunks/' + index,
        'PUT',
        blob.subarray(start, start + file.chunkSize),
        { raw: true },
      ),
      200,
    );
  const finished = await (
    await status(await anon.request(fileRoute + '/finish', 'POST', {}), 200)
  ).json();
  assert.equal(finished.attachments.length, 1);
  checks++;
  const repeat = await (
    await status(await anon.request(fileRoute + '/finish', 'POST', {}), 200)
  ).json();
  assert.equal(
    repeat.events.filter((e: { action: string }) => e.action === 'Documento firmado adjuntado')
      .length,
    1,
  );
  checks++;
  await status(
    await anon.request(fileRoute + '/chunks/0', 'PUT', blob.subarray(0, file.chunkSize), {
      raw: true,
    }),
    409,
  );
  await status(await new Client().request(fileRoute + '/chunks/0'), 404);
  await status(await anon.request(route(record.id) + '/attachments', 'POST', meta), 409);
  const download = await (
    await status(await admin.request(fileRoute + '/download', 'POST', {}), 200)
  ).json();
  const parts = [];
  for (let i = 0; i < Math.ceil(download.size / download.chunkSize); i++)
    parts.push(
      Buffer.from(
        await (await status(await anon.request(fileRoute + '/chunks/' + i), 200)).arrayBuffer(),
      ),
    );
  assert.equal(createHash('sha256').update(Buffer.concat(parts)).digest('hex'), digest);
  checks++;
  const invalidUpload = await (
    await status(
      await anon.request(route(record.id) + '/attachments', 'POST', {
        ...meta,
        size: pdfBytes.length,
        sha256: '0'.repeat(64),
      }),
      200,
    )
  ).json();
  const invalidRoute = route(record.id) + '/attachments/' + invalidUpload.id;
  await status(await anon.request(invalidRoute + '/chunks/0', 'PUT', pdfBytes, { raw: true }), 200);
  await status(await anon.request(invalidRoute + '/finish', 'POST', {}), 400);
  await status(await anon.request(invalidRoute + '/chunks/0'), 405);
  await status(await anon.request(invalidRoute, 'DELETE'), 200);
  const final = await (
    await status(await anon.request(route(record.id), 'PATCH', { version: 2, data }), 200)
  ).json();
  assert.equal(final.attachments[0].version, 2);
  assert.equal(final.version, 3);
  checks += 2;
  const query = '?q=' + prefix;
  const history = await (
    await status(await admin.request('/api/bienes/requests' + query), 200)
  ).json();
  assert.equal(history.total, 1);
  assert.equal(history.records[0].id, record.id);
  checks += 2;
  for (let i = 0; i < 9; i++) {
    const extra = await (
      await status(
        await admin.request('/api/bienes/requests', 'POST', {
          data: { ...data, holder: prefix + ' ' + i },
          key: randomUUID(),
        }),
        201,
      )
    ).json();
    ids.push(extra.id);
  }
  const paged = await (
    await status(await admin.request('/api/bienes/requests' + query + '&page=2'), 200)
  ).json();
  assert.equal(paged.total, 10);
  assert.equal(paged.records.length, 2);
  checks += 2;
  await status(await admin.request('/api/bienes/requests?from=2026-02-31'), 400);
  const report = await status(await admin.request('/api/bienes/requests/export' + query), 200);
  const exportBook = new ExcelJS.Workbook();
  await exportBook.xlsx.load(Buffer.from(await report.arrayBuffer()) as unknown as ExcelJS.Buffer);
  assert.equal(exportBook.worksheets[0].rowCount, 11);
  checks++;
  await status(await admin.request(route(record.id), 'DELETE', { version: 3 }), 200);
  await status(await anon.request(route(record.id)), 404);
  assert.ok((await db.solicitudBien.findUniqueOrThrow({ where: { id: record.id } })).deletedAt);
  checks++;
  assert.equal(
    await db.solicitudBienAdjunto.count({ where: { solicitudId: record.id, completo: true } }),
    1,
  );
  checks++;
  console.log(`${checks} comprobaciones de bienes completadas.`);
} finally {
  await db.solicitudBienAdjunto.deleteMany({ where: { solicitudId: { in: ids } } });
  await db.solicitudBienEvento.deleteMany({ where: { solicitudId: { in: ids } } });
  await db.solicitudBien.deleteMany({ where: { id: { in: ids } } });
  await db.administrador.deleteMany({ where: { usuario: { startsWith: prefix } } });
  await db.$disconnect();
}
