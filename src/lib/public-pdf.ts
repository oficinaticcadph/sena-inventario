import { PDFDocument, StandardFonts, rgb, type PDFFont } from 'pdf-lib';
import type { Prisma } from '@prisma/client';
import { generateWorkbook } from './template';
import { softwareDefaults, withSoftwareDefaults } from './software';
import { coreFields, manualFields, type Ficha } from './fields';

export const publicPdfSelect = {
  placaSena: true,
  componente: true,
  marca: true,
  modelo: true,
  serial: true,
  sede: true,
  disco: true,
  procesador: true,
  ram: true,
  grupo: true,
  ficha: true,
  cuentadante: { select: { nombre: true } },
} satisfies Prisma.EquipoSelect;
type PublicPdfEquipo = Prisma.EquipoGetPayload<{ select: typeof publicPdfSelect }>;

export function publicReportData(e: PublicPdfEquipo): Ficha {
  const data: Ficha = {};
  data.nombreUsuario = e.cuentadante?.nombre || 'Sin asignar';
  for (const key of [
    'placaSena',
    'componente',
    'marca',
    'modelo',
    'serial',
    'sede',
    'disco',
    'procesador',
    'ram',
  ] as const)
    data[key] = e[key];
  const software = withSoftwareDefaults(e.ficha as Ficha);
  for (const key of Object.keys(softwareDefaults)) data[key] = software[key];
  // Nunca propagar ficha completa: incluye jefe, notas, diagnóstico e información interna.
  return data;
}

function printable(text: string, font: PDFFont) {
  return Array.from(text.normalize('NFC'))
    .map((c) => {
      if (c === '\n') return c;
      try {
        font.encodeText(c);
        return c;
      } catch {
        return '?';
      }
    })
    .join('');
}
function wrap(text: string, font: PDFFont, size: number, width: number) {
  const lines: string[] = [];
  for (const paragraph of text.split('\n')) {
    let line = '';
    for (const word of paragraph.trim().split(/\s+/)) {
      if (!word) continue;
      if (font.widthOfTextAtSize(line ? line + ' ' + word : word, size) <= width) {
        line = line ? line + ' ' + word : word;
        continue;
      }
      if (line) {
        lines.push(line);
        line = '';
      }
      for (const c of word) {
        if (line && font.widthOfTextAtSize(line + c, size) > width) {
          lines.push(line);
          line = '';
        }
        line += c;
      }
    }
    lines.push(line);
  }
  return lines;
}
function endCell(range: string) {
  const match = range
    .split(':')
    .at(-1)!
    .match(/([A-Z]+)(\d+)/)!;
  return {
    col: [...match[1]].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0),
    row: Number(match[2]),
  };
}

export async function generatePublicPdf(e: PublicPdfEquipo, now = new Date()) {
  const workbook = await generateWorkbook(publicReportData(e), e.grupo, '', now);
  const sheet = workbook.getWorksheet('Reporte Técnico')!;
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Hoja de vida ${e.placaSena}`);
  pdf.setAuthor('SENA');
  pdf.setSubject('GTI-F-132 - Consulta pública');
  pdf.setCreationDate(now);
  const regular = await pdf.embedFont(StandardFonts.Helvetica),
    bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  // A3 permite conservar en una página las proporciones y todos los bloques del formato oficial.
  const page = pdf.addPage([841.89, 1190.55]);
  const margin = 24;
  const xs = [0],
    ys = [0];
  for (let col = 1; col <= 12; col++)
    xs.push(xs.at(-1)! + ((sheet.getColumn(col).width || 8.43) * 7 + 5) * 0.75);
  for (let row = 1; row <= 48; row++) ys.push(ys.at(-1)! + (sheet.getRow(row).height || 15));
  const scale = Math.min(
    (page.getWidth() - margin * 2) / xs[12],
    (page.getHeight() - margin * 2 - 35) / ys[48],
  );
  const top = page.getHeight() - margin;
  const merges = new Map((sheet.model.merges || []).map((r) => [r.split(':')[0], endCell(r)]));
  const overflow: { label: string; text: string }[] = [];
  const labelMap: Record<string, string> = {
    ...coreFields,
    ...manualFields,
    placaSena: 'Placa SENA',
  };
  const { cellMap } = await import('./template');
  const cellLabels = Object.fromEntries(
    Object.entries(cellMap).map(([key, address]) => [address, labelMap[key] || key]),
  );
  for (let row = 1; row <= 48; row++)
    for (let col = 1; col <= 12; col++) {
      const cell = sheet.getCell(row, col);
      if (cell.isMerged && cell.master.address !== cell.address) continue;
      const end = merges.get(cell.address) || { row, col };
      const x = margin + xs[col - 1] * scale,
        y = top - ys[end.row] * scale;
      const w = (xs[end.col] - xs[col - 1]) * scale,
        h = (ys[end.row] - ys[row - 1]) * scale;
      const fill = cell.fill;
      const dark =
        fill?.type === 'pattern' &&
        fill.pattern === 'solid' &&
        (fill.fgColor?.theme === 1 || fill.fgColor?.argb?.endsWith('000000') === true);
      if (dark) page.drawRectangle({ x, y, width: w, height: h, color: rgb(0, 0, 0) });
      for (const edge of ['top', 'bottom', 'left', 'right'] as const) {
        if (!cell.border?.[edge]?.style) continue;
        const start = { x: edge === 'right' ? x + w : x, y: edge === 'top' ? y + h : y };
        const finish = { x: edge === 'left' ? x : x + w, y: edge === 'bottom' ? y : y + h };
        page.drawLine({ start, end: finish, thickness: 0.45, color: rgb(0.25, 0.25, 0.25) });
      }
      if (!cell.text) continue;
      const font = cell.font?.bold ? bold : regular;
      const text = printable(cell.text, font),
        padding = 2;
      let size = Math.min((cell.font?.size || 10) * scale, 10),
        lines = wrap(text, font, size, w - padding * 2);
      while (size > 6.5 && lines.length * size * 1.12 > h - padding * 2) {
        size -= 0.25;
        lines = wrap(text, font, size, w - padding * 2);
      }
      if (lines.length * size * 1.12 > h - padding * 2) {
        overflow.push({ label: cellLabels[cell.address] || `Campo ${cell.address}`, text });
        lines = wrap('Ver anexo', font, 6.5, w - padding * 2);
        size = 6.5;
      }
      const lineHeight = size * 1.12;
      let baseline = y + (h + lines.length * lineHeight) / 2 - lineHeight + size * 0.15;
      for (const line of lines) {
        const width = font.widthOfTextAtSize(line, size);
        const dx =
          cell.alignment?.horizontal === 'center'
            ? (w - width) / 2
            : cell.alignment?.horizontal === 'right'
              ? w - padding - width
              : padding;
        page.drawText(line, {
          x: x + dx,
          y: baseline,
          size,
          font,
          color: dark ? rgb(1, 1, 1) : rgb(0, 0, 0),
        });
        baseline -= lineHeight;
      }
    }
  page.drawRectangle({x:margin,y:top-ys[48]*scale,width:xs[12]*scale,height:ys[48]*scale,borderWidth:0.45,borderColor:rgb(0.25,0.25,0.25)});
  const picture = sheet.getImages()[0];
  if (picture) {
    const asset = workbook.getImage(Number(picture.imageId));
    if (asset.buffer) {
      const logo = await pdf.embedPng(new Uint8Array(asset.buffer as ArrayBuffer));
      const height = (ys[2] - 4) * scale;
      const width = (height * logo.width) / logo.height;
      page.drawImage(logo, {
        x: margin + (xs[10] * scale) / 2 - width / 2,
        y: top - ys[2] * scale + 2 * scale,
        width,
        height,
      });
    }
  }
  // Casillas vacías: ninguna clasificación se asigna automáticamente.
  for (const col of [2, 7, 10])
    page.drawRectangle({
      x: margin + xs[col - 1] * scale + 2,
      y: top - ys[8] * scale + 3,
      width: 12,
      height: 12,
      borderWidth: 0.5,
      borderColor: rgb(0.3, 0.3, 0.3),
    });
  page.drawText('Consulta pública. Incluye el cuentadante; se omiten contactos, notas internas y firmas.', {
    x: margin,
    y: top - ys[48] * scale - 16,
    size: 8,
    font: regular,
    color: rgb(0.25, 0.25, 0.25),
  });
  if (overflow.length) {
    let annex = pdf.addPage([841.89, 1190.55]),
      cursor = 1140;
    const heading = () => {
      annex.drawText('GTI-F-132 - Información complementaria', {
        x: 35,
        y: cursor,
        size: 14,
        font: bold,
      });
      cursor -= 30;
    };
    heading();
    for (const item of overflow) {
      const lines = wrap(`${item.label}: ${item.text}`, regular, 10, 770);
      for (const line of lines) {
        if (cursor < 40) {
          annex = pdf.addPage([841.89, 1190.55]);
          cursor = 1140;
          heading();
        }
        annex.drawText(line, { x: 35, y: cursor, size: 10, font: regular });
        cursor -= 14;
      }
      cursor -= 12;
    }
  }
  return pdf.save();
}
