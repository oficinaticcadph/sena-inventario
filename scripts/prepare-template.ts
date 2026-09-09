import ExcelJS from 'exceljs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { preserveDrawings } from '../src/lib/ooxml';
import { clearExample, templatePath } from '../src/lib/template';
const input = process.argv[2] || process.env.TEMPLATE_SOURCE_PATH;
if (!input) throw new Error('Indica TEMPLATE_SOURCE_PATH o la ruta como argumento.');
const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(input);
const sheet = clearExample(wb);
await mkdir('templates', { recursive: true });
await writeFile(
  templatePath,
  await preserveDrawings(await readFile(input), Buffer.from(await wb.xlsx.writeBuffer()), true),
);
console.log(
  JSON.stringify({
    plantilla: templatePath,
    combinaciones: sheet.model.merges?.length,
    logos: sheet.getImages().length,
  }),
);
