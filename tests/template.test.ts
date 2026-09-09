import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import { generateWorkbook, templatePath, cellMap } from '../src/lib/template';
import { preserveDrawings } from '../src/lib/ooxml';
import { normalizePlate, isMissing, bogotaDate, maskPII } from '../src/lib/fields';
import { equipoSchema, passwordSchema } from '../src/lib/validation';
import { withSoftwareDefaults, softwareDefaults } from '../src/lib/software';

test('Software conserva valores originales y respeta ediciones y vacíos explícitos', async () => {
  assert.equal(withSoftwareDefaults({}).so, 'Windows 11');
  const custom = withSoftwareDefaults({
    so: 'Linux',
    soVersion: '2026',
    antivirus: '',
    officeLicencia: 'NO',
  });
  const wb = await generateWorkbook(custom, 'Manual', 'Técnico de prueba');
  const sheet = wb.getWorksheet('Reporte Técnico')!;
  assert.equal(sheet.getCell('E26').text, 'Linux');
  assert.equal(sheet.getCell('J26').text, '2026');
  assert.equal(sheet.getCell('E28').text, '');
  assert.equal(sheet.getCell('K27').text, 'NO');
  const defaults = await generateWorkbook({}, 'Manual', 'Técnico de prueba');
  for (const [key, value] of Object.entries(softwareDefaults))
    assert.equal(defaults.getWorksheet('Reporte Técnico')!.getCell(cellMap[key]).text, value, key);
});
test('Normaliza placas y datos ausentes sin perder ceros iniciales', () => {
  assert.equal(normalizePlate(' 00123a '), '00123A');
  assert.equal(normalizePlate('N/A'), '');
  assert.ok(isMissing(' n/a '));
  assert.ok(!isMissing('0'));
});
test('Fecha del reporte usa Colombia, incluso cerca de medianoche UTC', () => {
  assert.equal(bogotaDate(new Date('2026-09-10T02:00:00Z')), '2026-09-09');
});
test('Valida placa, campos inesperados y longitud real de contraseña bcrypt', () => {
  assert.ok(!equipoSchema.safeParse({ placaSena: 'N/A' }).success);
  assert.ok(!equipoSchema.safeParse({ placaSena: '1', activo: false }).success);
  assert.ok(!passwordSchema.safeParse('é'.repeat(37)).success);
  assert.equal(maskPII('Cédula 1234567890'), 'Cédula ••••90');
});
test('Plantilla sin datos de ejemplo ni firma, con logo y 100 combinaciones', async () => {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(templatePath);
  const s = wb.getWorksheet('Reporte Técnico')!;
  assert.equal(s.model.merges?.length, 100);
  for (const cell of Object.values(cellMap)) assert.equal(s.getCell(cell).text, '', cell);
  assert.equal(s.getImages().length, 1);
  const zip = await JSZip.loadAsync(await readFile(templatePath));
  assert.equal(zip.file('xl/media/image2.jpeg'), null);
  const strings = await zip.file('xl/sharedStrings.xml')!.async('string');
  for (const value of [
    'Juan Camilo',
    'Windows 11',
    'Office 365',
    'Centro Agroempresarial',
    'Equipo sin ningún daño',
  ])
    assert.ok(!strings.includes(value));
  const drawing = await zip.file('xl/drawings/drawing1.xml')!.async('string');
  assert.equal((drawing.match(/<xdr:sp /g) || []).length, 3);
  assert.ok(!drawing.includes('r:embed="rId2"'));
});
test('Genera mapeo, manuales y fecha; preserva formatos y dibujos en el archivo final', async () => {
  const values = {
    placaSena: 'PRUEBA-001',
    componente: 'Portátil',
    marca: 'SENA',
    modelo: 'Equipo de prueba',
    serial: 'SERIAL-PRUEBA',
    nombreUsuario: 'Usuario de prueba',
    sede: 'Sede de prueba',
    disco: '512 GB',
    procesador: 'Procesador de prueba',
    ram: '16 GB',
    so: 'Sistema verificado',
    soVersion: 'Versión prueba',
    jefe: 'Jefe de prueba',
  };
  const wb = await generateWorkbook(
    values,
    'FORMACION',
    'Técnico de prueba',
    new Date('2026-09-10T02:00:00Z'),
  );
  const bytes = await preserveDrawings(
    await readFile(templatePath),
    Buffer.from(await wb.xlsx.writeBuffer()),
  );
  const output = new ExcelJS.Workbook();
  await output.xlsx.load(bytes as unknown as ExcelJS.Buffer);
  const sheet = output.getWorksheet('Reporte Técnico')!;
  for (const [key, value] of Object.entries(values))
    assert.equal(sheet.getCell(cellMap[key]).text, value);
  assert.equal(sheet.getCell('C45').text, 'Técnico de prueba');
  assert.equal(sheet.getCell('I10').value, 9);
  assert.equal(sheet.getCell('J10').value, 9);
  assert.equal(sheet.getCell('K10').value, 2026);
  assert.equal(sheet.getCell('H12').text, 'X');
  assert.equal(sheet.getCell('E27').text, 'Office 365');
  assert.equal(sheet.getCell('C47').text, 'Técnico:');
  assert.equal(sheet.getImages().length, 1);
  const base = new ExcelJS.Workbook();
  await base.xlsx.readFile(templatePath);
  const original = base.getWorksheet('Reporte Técnico')!;
  assert.deepEqual(sheet.model.merges, original.model.merges);
  assert.deepEqual(sheet.pageSetup, original.pageSetup);
  original.eachRow((row, n) => {
    assert.equal(sheet.getRow(n).height, row.height);
    row.eachCell((c) => {
      assert.deepEqual(sheet.getCell(c.address).border, c.border);
      assert.deepEqual(sheet.getCell(c.address).font, c.font);
    });
  });
  const zip = await JSZip.loadAsync(bytes);
  assert.equal(zip.file('xl/media/image2.jpeg'), null);
  const originalZip = await JSZip.loadAsync(await readFile(templatePath));
  assert.equal(
    await zip.file('xl/drawings/drawing1.xml')!.async('string'),
    await originalZip.file('xl/drawings/drawing1.xml')!.async('string'),
  );
  await mkdir('private/qa', { recursive: true });
  await writeFile('private/qa/HOJA_DE_VIDA_PRUEBA-001.xlsx', bytes);
});
