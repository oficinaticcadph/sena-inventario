import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { hash, compare } from 'bcryptjs';
import ExcelJS from 'exceljs';
import { PDFDocument } from 'pdf-lib';
process.loadEnvFile('.env');
if (!process.env.DATABASE_URL?.includes('127.0.0.1:55432'))
  throw new Error('Las pruebas solo se ejecutan sobre la base local.');
const db = new PrismaClient();
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:3000';
const origin = new URL(process.env.NEXTAUTH_URL!).origin;
const prefix = 'qa_' + randomBytes(5).toString('hex');
const password = randomBytes(18).toString('base64url');
let checks = 0;
class Client {
  jar = new Map<string, string>();
  async request(path: string, method = 'GET', data?: unknown, customOrigin = origin) {
    const response = await fetch(base + path, {
      method,
      headers: {
        Cookie: [...this.jar].map(([k, v]) => `${k}=${v}`).join('; '),
        Origin: customOrigin,
        ...(data ? { 'Content-Type': 'application/json' } : {}),
      },
      body: data ? JSON.stringify(data) : undefined,
      redirect: 'manual',
    });
    for (const cookie of response.headers.getSetCookie()) {
      const [part] = cookie.split(';');
      const index = part.indexOf('=');
      this.jar.set(part.slice(0, index), part.slice(index + 1));
    }
    return response;
  }
  async login(usuario: string) {
    const csrf = await (await this.request('/api/auth/csrf')).json();
    const response = await fetch(base + '/api/auth/callback/credentials', {
      method: 'POST',
      headers: {
        Cookie: [...this.jar].map(([k, v]) => `${k}=${v}`).join('; '),
        'Content-Type': 'application/x-www-form-urlencoded',
        Origin: origin,
      },
      body: new URLSearchParams({
        csrfToken: csrf.csrfToken,
        usuario,
        password,
        callbackUrl: origin,
        json: 'true',
      }),
      redirect: 'manual',
    });
    for (const cookie of response.headers.getSetCookie()) {
      const [part] = cookie.split(';');
      const index = part.indexOf('=');
      this.jar.set(part.slice(0, index), part.slice(index + 1));
    }
    const session = await (await this.request('/api/auth/session')).json();
    assert.ok(session.user?.id, 'Inicio de sesión real con credenciales');
    checks++;
  }
}
async function status(response: Response, expected: number, label: string) {
  const content = response.status === expected ? '' : await response.text();
  assert.equal(response.status, expected, label + ' ' + content.slice(0, 200));
  checks++;
}
try {
  const adminUser = await db.administrador.create({
    data: {
      usuario: prefix + '_admin',
      nombre: 'Prueba administrador',
      rol: 'admin',
      passwordHash: await hash(password, 12),
    },
  });
  const consultUser = await db.administrador.create({
    data: {
      usuario: prefix + '_consulta',
      nombre: 'Prueba consulta',
      rol: 'consulta',
      passwordHash: await hash(password, 12),
    },
  });
  const admin = new Client(),
    consulta = new Client(),
    anon = new Client();
  await status(await anon.request('/api/equipos?q=1'), 200, 'Sugerencias públicas sin sesión');
  const publicHome = await anon.request('/');
  await status(publicHome, 200, 'Inicio público sin sesión');
  assert.ok((await publicHome.text()).includes('Entrar como administrador'));
  checks++;
  await status(await anon.request('/admin'), 307, 'Panel redirige sin sesión');
  await Promise.all([admin.login(adminUser.usuario), consulta.login(consultUser.usuario)]);
  await status(
    await consulta.request('/api/usuarios', 'POST', {}),
    403,
    'Consulta no crea usuarios',
  );
  await status(await consulta.request('/api/equipos', 'POST', {}), 403, 'Consulta no crea equipos');
  await status(
    await admin.request('/api/equipos', 'POST', {}, 'https://otro.example'),
    403,
    'Bloquea origen ajeno',
  );
  const data = {
    placaSena: prefix.toUpperCase(),
    componente: 'Portátil',
    marca: 'Marca prueba',
    modelo: 'Modelo prueba',
    serial: 'SERIAL-PRUEBA',
    sede: 'Sede prueba',
    ram: '16 GB',
    disco: '512 GB',
    procesador: 'Procesador prueba',
    dominio: '',
    hostname: '',
    grupo: 'Manual',
    nombreUsuario: 'Responsable 1234567890',
    contacto: '3001234567',
    ficha: {},
  };
  const created = await admin.request('/api/equipos', 'POST', data);
  await status(created, 201, 'Crea equipo');
  const { id } = await created.json();
  await status(await admin.request('/api/equipos', 'POST', data), 409, 'Impide placa duplicada');
  const before = await db.equipo.findUniqueOrThrow({ where: { id } });
  assert.equal(before.version, 1);
  checks++;
  const page = await consulta.request(`/equipos/${id}`);
  await status(page, 200, 'Consulta ficha autenticada');
  const html = await page.text();
  const publicPage = await anon.request(`/equipos/${id}`);
  await status(publicPage, 200, 'Ficha pública sin sesión');
  const publicHtml = await publicPage.text();
  for (const secret of ['Responsable', '3001234567', '1234567890', adminUser.nombre]) {
    assert.ok(!publicHtml.includes(secret), 'La vista pública no entrega datos personales');
    checks++;
  }
  assert.ok(publicHtml.includes('Historial de movimientos') && publicHtml.includes('<ol'));
  assert.ok(publicHtml.includes(`/api/equipos/${id}/pdf`));
  const publicPdf = await anon.request(`/api/equipos/${id}/pdf`);
  await status(publicPdf, 200, 'PDF disponible sin sesión');
  assert.equal(publicPdf.headers.get('content-type'), 'application/pdf');
  assert.ok(publicPdf.headers.get('content-disposition')?.includes('.pdf'));
  const parsedPdf = await PDFDocument.load(await publicPdf.arrayBuffer());
  assert.equal(parsedPdf.getPageCount(), 1);
  await status(
    await anon.request('/api/equipos/no-existe/pdf'),
    404,
    'PDF inexistente devuelve 404',
  );
  checks += 4;
  checks++;
  await status(await anon.request(`/api/equipos/${id}`, 'PATCH', {}), 401, 'Visitante no edita');
  await status(
    await anon.request(`/api/equipos/${id}/excel`, 'POST', { version: 1, campos: {} }),
    401,
    'Descarga requiere autor autenticado',
  );
  assert.ok(
    !html.includes('3001234567') && !html.includes('1234567890'),
    'No entrega PII numérica en HTML ni RSC',
  );
  checks++;
  await status(
    await consulta.request(`/api/equipos/${id}`, 'PATCH', {
      version: 1,
      datos: data,
      detalle: 'No autorizado',
    }),
    403,
    'Consulta no edita',
  );
  await status(
    await consulta.request('/api/movimientos', 'POST', { equipoId: id, detalle: 'No autorizado' }),
    403,
    'Consulta no crea movimientos manuales',
  );
  const excel = await consulta.request(`/api/equipos/${id}/excel`, 'POST', {
    version: 1,
    campos: { hostname: 'PRUEBA-HOST', so: 'Sistema manual' },
  });
  await status(excel, 200, 'Consulta genera Excel');
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(Buffer.from(await excel.arrayBuffer()) as unknown as ExcelJS.Buffer);
  const sheet = wb.getWorksheet('Reporte Técnico')!;
  assert.equal(sheet.getCell('J12').text, 'PRUEBA-HOST');
  assert.equal(sheet.getCell('E27').text, 'Office 365');
  assert.equal(sheet.getCell('E28').text, 'Windows Defender');
  checks += 2;
  assert.equal(sheet.getCell('E26').text, 'Sistema manual');
  assert.equal(sheet.getCell('C17').text, 'Responsable ••••90');
  assert.equal(sheet.getCell('C45').text, 'Prueba consulta');
  checks += 4;
  assert.equal((await db.equipo.findUniqueOrThrow({ where: { id } })).hostname, '');
  checks++;
  assert.equal(
    await db.movimiento.count({
      where: { equipoId: id, tipo: 'generacion', autorId: consultUser.id },
    }),
    1,
  );
  checks++;
  await status(
    await consulta.request(`/api/equipos/${id}/excel`, 'POST', {
      version: 1,
      campos: { marca: 'Otra' },
    }),
    400,
    'No permite sustituir datos existentes desde consulta',
  );
  const updated = { ...data, nombreUsuario: 'Nuevo responsable' };
  await status(
    await admin.request(`/api/equipos/${id}`, 'PATCH', {
      version: 1,
      datos: updated,
      detalle: 'Reasignación de prueba',
    }),
    200,
    'Reasigna equipo',
  );
  assert.equal(
    await db.movimiento.count({
      where: { equipoId: id, tipo: 'reasignacion', autorId: adminUser.id },
    }),
    1,
  );
  checks++;
  await status(
    await admin.request(`/api/equipos/${id}`, 'PATCH', {
      version: 1,
      datos: data,
      detalle: 'Cambio simultáneo',
    }),
    409,
    'Rechaza versión desactualizada',
  );
  await status(
    await consulta.request(`/api/equipos/${id}/excel`, 'POST', { version: 1, campos: {} }),
    409,
    'Rechaza reporte desactualizado',
  );
  await status(
    await admin.request(`/api/equipos/${id}`, 'DELETE', { version: 2, detalle: 'Baja de prueba' }),
    200,
    'Baja lógica',
  );
  assert.equal((await db.equipo.findUniqueOrThrow({ where: { id } })).activo, false);
  checks++;
  assert.ok((await db.movimiento.count({ where: { equipoId: id } })) >= 4);
  checks++;
  await status(
    await consulta.request('/api/usuarios', 'PATCH', {
      accion: 'editar',
      id: adminUser.id,
      usuario: adminUser.usuario,
      nombre: 'Intruso',
    }),
    403,
    'Consulta no edita cuentas',
  );
  await status(
    await admin.request('/api/usuarios', 'PATCH', {
      accion: 'editar',
      id: consultUser.id,
      usuario: consultUser.usuario,
      nombre: 'Nombre corregido',
    }),
    200,
    'Edita nombre sin contraseña',
  );
  assert.ok(
    await compare(
      password,
      (await db.administrador.findUniqueOrThrow({ where: { id: consultUser.id } })).passwordHash,
    ),
  );
  checks++;
  await status(
    await admin.request('/api/usuarios', 'PATCH', {
      accion: 'editar',
      id: consultUser.id,
      usuario: consultUser.usuario,
      nombre: 'Nombre corregido',
      password: 'corta',
    }),
    400,
    'Rechaza contraseña corta',
  );
  await status(
    await consulta.request(`/api/equipos/${id}`, 'DELETE', {
      version: 3,
      detalle: 'Error de registro',
      permanente: true,
      placa: data.placaSena,
    }),
    403,
    'Consulta no elimina',
  );
  await status(
    await admin.request(`/api/equipos/${id}`, 'DELETE', {
      version: 3,
      detalle: 'Error de registro',
      permanente: true,
      placa: 'incorrecta',
    }),
    400,
    'Exige placa correcta',
  );
  const saved = await db.equipo.findUniqueOrThrow({ where: { id } });
  await status(
    await admin.request(`/api/equipos/${id}`, 'DELETE', {
      version: 2,
      detalle: 'Error de registro',
      permanente: true,
      placa: saved.placaSena,
    }),
    409,
    'Eliminación rechaza versión vieja',
  );
  await status(
    await admin.request(`/api/equipos/${id}`, 'DELETE', {
      version: 3,
      detalle: 'Error de registro',
      permanente: true,
      placa: saved.placaSena,
    }),
    200,
    'Elimina registro',
  );
  assert.equal(await db.equipo.findUnique({ where: { id } }), null);
  assert.equal(
    await db.equipoEliminado.count({ where: { equipoId: id, autorId: adminUser.id } }),
    1,
  );
  checks += 2;
  await status(
    await admin.request('/api/usuarios', 'PATCH', {
      accion: 'editar',
      id: consultUser.id,
      usuario: consultUser.usuario,
      nombre: 'Nombre corregido',
      password: password + 'a',
    }),
    200,
    'Restablece contraseña',
  );
  assert.ok(
    await compare(
      password + 'a',
      (await db.administrador.findUniqueOrThrow({ where: { id: consultUser.id } })).passwordHash,
    ),
  );
  checks++;
  await status(
    await admin.request('/api/usuarios', 'PATCH', { id: consultUser.id, activo: false }),
    200,
    'Desactiva usuario',
  );
  await status(
    await consulta.request(`/api/equipos/${id}/excel`, 'POST', { version: 3, campos: {} }),
    401,
    'Revoca sesión existente inmediatamente',
  );
  await status(
    await admin.request('/api/usuarios', 'PATCH', { id: adminUser.id, activo: false }),
    400,
    'Impide autodesactivación',
  );
  await status(await admin.request('/'), 200, 'Inventario responde');
  await status(await admin.request('/admin/movimientos'), 200, 'Bitácora responde');
  await status(await admin.request('/admin/usuarios'), 200, 'Usuarios responde');
  console.log(
    `${checks} verificaciones de integración correctas: autenticación, roles, PII, Excel, auditoría, concurrencia y baja.`,
  );
} finally {
  await db.equipoEliminado.deleteMany({
    where: { placaSena: { startsWith: prefix.toUpperCase() } },
  });
  const equipment = await db.equipo.findMany({
    where: { placaSena: { startsWith: prefix.toUpperCase() } },
    select: { id: true, cuentadanteId: true },
  });
  await db.movimiento.deleteMany({ where: { equipoId: { in: equipment.map((e) => e.id) } } });
  await db.equipo.deleteMany({ where: { id: { in: equipment.map((e) => e.id) } } });
  await db.cuentadante.deleteMany({
    where: {
      nombre: { in: ['Responsable 1234567890', 'Nuevo responsable'] },
      equipos: { none: {} },
    },
  });
  const users = await db.administrador.findMany({
    where: { usuario: { startsWith: prefix } },
    select: { id: true },
  });
  await db.eventoUsuario.deleteMany({ where: { autorId: { in: users.map((u) => u.id) } } });
  await db.administrador.deleteMany({ where: { id: { in: users.map((u) => u.id) } } });
  await db.$disconnect();
}
