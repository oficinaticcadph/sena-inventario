import ExcelJS from 'exceljs';
import path from 'node:path';
import { bogotaDate, type Ficha } from './fields';
import { withSoftwareDefaults } from './software';
export const templatePath = path.join(process.cwd(), 'templates', 'GTI-F-132.xlsx');
export const cellMap: Record<string, string> = {
  hostname: 'J12',
  dominio: 'J13',
  enrolado: 'E13',
  observacion: 'B14',
  incidente: 'C15',
  requerimiento: 'I15',
  nombreUsuario: 'C17',
  jefe: 'C18',
  sede: 'C19',
  solicitud: 'C20',
  componente: 'A23',
  marca: 'B23',
  modelo: 'D23',
  serial: 'E23',
  placaSena: 'G23',
  tipoParte: 'H23',
  numeroParte: 'I23',
  especificacionParte: 'J23',
  disco: 'E35',
  procesador: 'E36',
  ram: 'E37',
  borrado: 'E38',
  accion: 'C39',
  causas: 'C43',
  recomendacion: 'C44',
  tecnico: 'C45',
  repuesto: 'K35',
  garantia: 'K36',
  siniestro: 'K37',
  concepto: 'K39',
  asignacion: 'K40',
  reasignacion: 'K41',
  devolucion: 'K42',
};
for (const [i, key] of [
  'so',
  'office',
  'antivirus',
  'adobe',
  'laps',
  'zip',
  'vpn',
  'jafm',
].entries()) {
  cellMap[key] = `E${26 + i}`;
  cellMap[key + 'Version'] = `J${26 + i}`;
  cellMap[key + 'Licencia'] = `K${26 + i}`;
}
export function clearExample(workbook: ExcelJS.Workbook) {
  const sheet = workbook.getWorksheet('Reporte Técnico');
  if (!sheet) throw new Error('No existe Reporte Técnico');
  for (const addr of [...Object.values(cellMap), 'I10', 'J10', 'K10', 'E12', 'H12'])
    sheet.getCell(addr).value = null;
  // Remove sample signatures/notes while retaining the official signature labels and logo.
  sheet.getCell('C47').value = 'Técnico:';
  sheet.getCell('H47').value = 'Usuario:';
  sheet.eachRow((row) =>
    row.eachCell((cell) => {
      if (cell.note) delete (cell as unknown as { note?: unknown }).note;
    }),
  );
  workbook.creator = 'SENA';
  workbook.lastModifiedBy = 'SENA';
  workbook.title = 'Hoja de vida de equipo';
  workbook.subject = 'GTI-F-132';
  workbook.description = '';
  workbook.company = 'SENA';
  return sheet;
}
export async function generateWorkbook(
  data: Ficha,
  group: string,
  technician: string,
  now = new Date(),
) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(templatePath);
  const sheet = clearExample(workbook);
  const reportData = withSoftwareDefaults(data);
  for (const [key, cell] of Object.entries(cellMap))
    sheet.getCell(cell).value = reportData[key] || null;
  const [year, month, day] = bogotaDate(now).split('-').map(Number);
  sheet.getCell('I10').value = day;
  sheet.getCell('J10').value = month;
  sheet.getCell('K10').value = year;
  if (group === 'Funcionarios') sheet.getCell('E12').value = 'X';
  if (group === 'FORMACION') sheet.getCell('H12').value = 'X';
  sheet.getCell('C45').value = technician;
  // A name identifies the author; no handwritten or digital signature is fabricated.
  return workbook;
}
