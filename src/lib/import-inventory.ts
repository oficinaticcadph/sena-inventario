import ExcelJS from 'exceljs';
import { clean, normalizePlate } from './fields';
export interface ImportRow {
  placaSena: string;
  componente: string;
  marca: string;
  modelo: string;
  serial: string;
  sede: string;
  disco: string;
  procesador: string;
  ram: string;
  dominio: string;
  grupo: string;
  nombre: string;
  contacto: string;
  contexto: Record<string, string>;
  origen: Record<string, string>;
  sourceRow: number;
}
export interface Issue {
  hoja: string;
  fila: number;
  tipo: string;
  primeraHoja?: string;
  primeraFila?: number;
}
const columns = {
  placaSena: 11,
  componente: 3,
  marca: 8,
  modelo: 9,
  serial: 10,
  sede: 36,
  disco: 18,
  procesador: 15,
  ram: 14,
  dominio: 33,
} as const;
export async function readInventory(file: string) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(file);
  const rows: ImportRow[] = [];
  const issues: Issue[] = [];
  const seen = new Map<string, ImportRow>();
  const conflicted = new Set<string>();
  const quarantine: ImportRow[] = [];
  const summary: Record<string, number> = {};
  for (const name of ['Funcionarios', 'FORMACION', 'ELECTRONICOS']) {
    const sheet = workbook.getWorksheet(name);
    if (!sheet) throw new Error(`Falta la hoja ${name}`);
    if (
      sheet.getCell('K4').text.trim() !== 'Placa' ||
      sheet.getCell('C4').text.trim() !== 'Elemento'
    )
      throw new Error(`Encabezados inesperados en ${name}. Se requiere fila 4.`);
    summary[name] = 0;
    sheet.eachRow((row, n) => {
      if (n < 5) return;
      const val = (col: number) => {
        const cell = row.getCell(col);
        return clean(
          cell.value instanceof Date ? cell.value.toISOString().slice(0, 10) : cell.text,
        );
      };
      if (!val(3) && !val(10) && !val(11)) return;
      summary[name]++;
      const placaSena = normalizePlate(val(11));
      if (!placaSena) {
        issues.push({ hoja: name, fila: n, tipo: 'sin_placa' });
        return;
      }
      const mapped = Object.fromEntries(
        Object.entries(columns).map(([key, col]) => [key, val(col)]),
      ) as Omit<ImportRow, 'grupo' | 'nombre' | 'contacto' | 'contexto' | 'origen' | 'sourceRow'>;
      const origen: Record<string, string> = {};
      for (let col = 1; col <= sheet.getRow(4).cellCount; col++) {
        const header = sheet.getRow(4).getCell(col).text.trim();
        if (header) origen[header] = val(col);
      }
      const contexto: Record<string, string> = {
        Ciudad: val(37),
        Departamento: val(38),
        Edificio: val(39),
        Piso: val(40),
        Sala: val(42),
        Estado: val(6),
        'Fecha de compra': val(56),
        'Inicio garantía': val(57),
        'Fin garantía': val(58),
        Administrador: val(44),
        'Centro de costos': val(51),
      };
      const record: ImportRow = {
        ...mapped,
        placaSena,
        grupo: name,
        nombre: val(45) || val(46),
        contacto: val(47),
        contexto,
        origen,
        sourceRow: n,
      };
      const previous = seen.get(placaSena);
      if (previous) {
        issues.push({
          hoja: name,
          fila: n,
          tipo: 'placa_duplicada',
          primeraHoja: previous.grupo,
          primeraFila: previous.sourceRow,
        });
        if (!conflicted.has(placaSena)) quarantine.push(previous);
        conflicted.add(placaSena);
        quarantine.push(record);
        return;
      }
      rows.push(record);
      seen.set(placaSena, record);
    });
  }
  return {
    rows: rows.filter((row) => !conflicted.has(row.placaSena)),
    issues,
    summary,
    quarantine,
  };
}
