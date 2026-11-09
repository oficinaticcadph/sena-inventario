import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import JSZip from 'jszip';
import ExcelJS from 'exceljs';
import { PDFDocument } from 'pdf-lib';
import { solicitudBienSchema } from '../src/lib/bienes-validation';
import { originalExcelBytes, originalPdfBytes } from '../src/lib/gil-format';
const data = {
  movement: 'SALIDA',
  date: '2026-11-09',
  area: 'Área de prueba',
  head: 'Coordinación de prueba',
  holderType: 'UNIPERSONAL',
  holder: 'Cuentadante de prueba',
  identification: 'ID-PRUEBA',
  destination: 'Formación',
  group: 'FICHA-PRUEBA',
  classification: 'Pública',
  authorizer: '',
  position: '',
  signature: '',
  members: [],
  items: [
    {
      code: '0001',
      description: 'Bien de prueba',
      unit: 'Unidad',
      requested: '2',
      delivered: '0',
      observations: '',
    },
  ],
};
test('Solicitud valida campos condicionales cantidades y datos inesperados', () => {
  assert.ok(solicitudBienSchema.safeParse(data).success);
  assert.equal(
    solicitudBienSchema.parse({ ...data, destination: 'Área administrativa' }).group,
    '',
  );
  assert.equal(solicitudBienSchema.safeParse({ ...data, date: '2026-02-30' }).success, false);
  assert.equal(solicitudBienSchema.safeParse({ ...data, holderType: 'MÚLTIPLE' }).success, false);
  assert.equal(
    solicitudBienSchema.safeParse({ ...data, items: [{ ...data.items[0], requested: '0' }] })
      .success,
    false,
  );
  assert.equal(
    solicitudBienSchema.safeParse({ ...data, items: [{ ...data.items[0], delivered: '-1' }] })
      .success,
    false,
  );
  assert.equal(solicitudBienSchema.safeParse({ ...data, autorId: 'forged' }).success, false);
});
test('Excel del servidor conserva las partes y el diseño originales y replica las hojas extensas', async () => {
  const source = await JSZip.loadAsync(await readFile('templates/GIL-F-014.xlsx'));
  const bytes = await originalExcelBytes(solicitudBienSchema.parse(data)),
    zip = await JSZip.loadAsync(bytes);
  for (const [name, entry] of Object.entries(source.files)) {
    if (
      entry.dir ||
      ['xl/worksheets/sheet2.xml', 'xl/styles.xml', 'xl/drawings/drawing2.xml'].includes(name)
    )
      continue;
    assert.deepEqual(
      await zip.file(name)!.async('uint8array'),
      await entry.async('uint8array'),
      name,
    );
  }
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(Buffer.from(bytes) as unknown as ExcelJS.Buffer);
  const sheet = wb.getWorksheet('FORMATO GIL-F-014')!;
  assert.equal(sheet.getCell('C26').value, '0001');
  assert.equal(sheet.getCell('J26').value, 0);
  assert.ok(sheet.getCell('E10').value instanceof Date);
  assert.equal(sheet.getCell('H14').dataValidation.type, 'list');
  assert.equal(sheet.getCell('H22').dataValidation.type, 'list');
  const many = await originalExcelBytes(
    solicitudBienSchema.parse({ ...data, items: Array.from({ length: 14 }, () => data.items[0]) }),
  );
  const expanded = new ExcelJS.Workbook();
  await expanded.xlsx.load(Buffer.from(many) as unknown as ExcelJS.Buffer);
  assert.equal(expanded.getWorksheet('Solicitud 3')!.getCell('B26').value, 13);
});
test('PDF del servidor conserva el formato original en carta y continúa sin mover sus filas', async () => {
  const one = await PDFDocument.load(await originalPdfBytes(solicitudBienSchema.parse(data)));
  assert.equal(one.getPageCount(), 1);
  assert.equal(one.getPage(0).getWidth(), 612);
  assert.equal(one.getPage(0).getHeight(), 792);
  const many = await PDFDocument.load(
    await originalPdfBytes(
      solicitudBienSchema.parse({
        ...data,
        items: Array.from({ length: 14 }, () => data.items[0]),
      }),
    ),
  );
  assert.equal(many.getPageCount(), 3);
});
