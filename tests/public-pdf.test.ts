import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { PDFDocument, PDFName } from 'pdf-lib';
import { generatePublicPdf, publicReportData } from '../src/lib/public-pdf';
const equipo = {
  placaSena: 'PDF-PRUEBA-001',
  componente: 'Portátil',
  marca: 'Marca de prueba',
  modelo: 'Modelo de prueba',
  serial: 'SERIAL-PRUEBA',
  sede: 'Sede de prueba',
  disco: '512 GB',
  procesador: 'Procesador de prueba',
  ram: '16 GB',
  grupo: 'FORMACION',
  cuentadante: { nombre: 'María Fernanda Pérez Gómez' },
  ficha: {
    so: 'Windows 11',
    antivirus: 'Antivirus verificado',
    jefe: 'PERSONA_PRIVADA',
    observacion: 'CONTACTO_PRIVADO',
    causas: 'NOTA_INTERNA',
    hostname: 'HOST_INTERNO',
  },
};
test('PDF público incluye cuentadante, campos técnicos y software permitido', () => {
  const data = publicReportData(equipo);
  assert.equal(data.antivirus, 'Antivirus verificado');
  assert.equal(data.office, 'Office 365');
  assert.equal(data.nombreUsuario, equipo.cuentadante.nombre);
  assert.equal(publicReportData({ ...equipo, cuentadante: null }).nombreUsuario, 'Sin asignar');
  for (const key of [
    'jefe',
    'observacion',
    'causas',
    'hostname',
    'contacto',
    'tecnico',
  ])
    assert.equal(data[key], undefined);
  assert.ok(!JSON.stringify(data).includes('PRIVAD'));
});
test('Genera un PDF real sin Excel adjunto y con formato de una página', async () => {
  const bytes = await generatePublicPdf(equipo, new Date('2026-09-09T18:00:00Z'));
  assert.equal(Buffer.from(bytes).subarray(0, 5).toString(), '%PDF-');
  const pdf = await PDFDocument.load(bytes);
  assert.equal(pdf.getPageCount(), 1);
  assert.equal(pdf.getAuthor(), 'SENA');
  assert.equal(pdf.getTitle(), 'Hoja de vida PDF-PRUEBA-001');
  assert.equal(pdf.catalog.get(PDFName.of('Names')), undefined);
  await mkdir('private/qa', { recursive: true });
  await writeFile('private/qa/HOJA_DE_VIDA_PUBLICA.pdf', bytes);
});
test('Textos largos conservan su contenido en un anexo sin desbordar la plantilla', async () => {
  const bytes = await generatePublicPdf({
    ...equipo,
    modelo: 'Modelo con características extensas '.repeat(14),
  });
  const pdf = await PDFDocument.load(bytes);
  assert.ok(pdf.getPageCount() > 1);
});
