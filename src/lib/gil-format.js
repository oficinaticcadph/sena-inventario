import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import JSZip from 'jszip';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
const crypto = { randomUUID };
const PDFLib = { PDFDocument, StandardFonts, rgb };
const children = (node) => Array.from(node.childNodes).filter((n) => n.nodeType === 1);
const dateLabel = (value) => value.split('-').reverse().join('/');
let template;
function getTemplate() {
  return (template ??= {
    xlsx: readFileSync(path.join(process.cwd(), 'templates/GIL-F-014.xlsx')).toString('base64'),
    pdf: readFileSync(path.join(process.cwd(), 'templates/GIL-F-014-base.pdf')).toString('base64'),
    ...JSON.parse(
      readFileSync(path.join(process.cwd(), 'templates/GIL-F-014-layout.json'), 'utf8'),
    ),
  });
}
// Las descargas conservan el diseño nativo de la plantilla proporcionada.
function originalPages(data) {
  const count = Math.max(
    1,
    Math.ceil(data.items.length / 6),
    Math.ceil((data.members || []).length / 3),
  );
  return Array.from({ length: count }, (_, page) => {
    const cells = {
      E10: dateLabel(data.date),
      K10: data.area,
      H13: data.head,
      H14: data.holderType,
      H15: data.holder,
      M15: data.identification,
      H22: data.destination === 'Área administrativa' ? 'Area administrativa' : data.destination,
      H23: data.group,
      E33: data.authorizer,
      K33: data.position,
      E34: data.signature,
    };
    for (let i = 0; i < 3; i++) {
      const member = data.holderType === 'MÚLTIPLE' ? data.members[page * 3 + i] : null;
      cells['E' + (18 + i)] = member?.name || '';
      cells['L' + (18 + i)] = member?.identification || '';
    }
    for (let i = 0; i < 6; i++) {
      const item = data.items[page * 6 + i],
        r = i + 26;
      for (const [col, key] of [
        ['C', 'code'],
        ['E', 'description'],
        ['H', 'unit'],
        ['I', 'requested'],
        ['J', 'delivered'],
        ['K', 'observations'],
      ])
        cells[col + r] = item?.[key] ?? '';
      cells['B' + r] = item ? String(page * 6 + i + 1) : '';
    }
    return cells;
  });
}
function originalCleanText(text, font) {
  return Array.from(String(text))
    .map((c) => {
      try {
        font.encodeText(c);
        return c;
      } catch {
        return '?';
      }
    })
    .join('');
}
function originalWrap(text, font, size, width) {
  const lines = [];
  for (const paragraph of text.split('\n')) {
    let line = '';
    for (const word of paragraph.split(/\s+/)) {
      if (!word) continue;
      if (font.widthOfTextAtSize((line ? line + ' ' : '') + word, size) <= width) {
        line += (line ? ' ' : '') + word;
        continue;
      }
      if (line) {
        lines.push(line);
        line = '';
      }
      for (const char of word) {
        if (line && font.widthOfTextAtSize(line + char, size) > width) {
          lines.push(line);
          line = '';
        }
        line += char;
      }
    }
    lines.push(line);
  }
  return lines;
}
async function originalPdfBytes(data) {
  const { PDFDocument, StandardFonts, rgb } = PDFLib,
    t = getTemplate();
  const doc = await PDFDocument.create(),
    font = await doc.embedFont(StandardFonts.Helvetica);
  const source = await PDFDocument.load(Uint8Array.from(atob(t.pdf), (c) => c.charCodeAt(0)));
  const height = source.getPage(0).getHeight(),
    b = t.bounds,
    width = b[2] - b[0],
    formHeight = b[3] - b[1],
    scale = 556 / width;
  const base = await doc.embedPage(source.getPage(0), {
    left: b[0],
    bottom: height - b[3],
    right: b[2],
    top: height - b[1],
  });
  const pages = originalPages(data);
  for (const values of pages) {
    const page = doc.addPage([612, 792]);
    page.drawPage(base, {
      x: 28,
      y: 792 - 28 - formHeight * scale,
      width: 556,
      height: formHeight * scale,
    });
    for (const [address, value] of Object.entries(values)) {
      if (value === '') continue;
      const field = t.fields[address];
      if (!field) throw Error('Falta la casilla ' + address + ' de la plantilla original.');
      const r = field.rect,
        x = 28 + (r[0] - b[0]) * scale,
        y = 792 - 28 - (r[3] - b[1]) * scale,
        w = (r[2] - r[0]) * scale,
        h = (r[3] - r[1]) * scale;
      let size = field.font * scale,
        lines = originalWrap(originalCleanText(value, font), font, size, w - 4);
      while (lines.length * (size + 1) > h - 2 && size > 4) {
        size -= 0.15;
        lines = originalWrap(originalCleanText(value, font), font, size, w - 4);
      }
      if (lines.length * (size + 1) > h - 1)
        throw Error(
          `El texto de ${address} no cabe en su casilla original. Acórtalo o distribuye el detalle en más ítems para conservar el formato sin cortar contenido.`,
        );
      const top = y + (h + lines.length * (size + 1)) / 2 - size - 1;
      for (let i = 0; i < lines.length; i++)
        page.drawText(lines[i], {
          x: x + 2,
          y: top - i * (size + 1),
          size,
          font,
          color: rgb(0, 0, 0),
        });
    }
    const index = ['Pública', 'Pública Clasificada', 'Pública Reservada'].indexOf(
        data.classification,
      ),
      box = t.checks[index];
    if (box) {
      const size = 10,
        x = 28 + (box[0] - b[0]) * scale,
        w = (box[2] - box[0]) * scale,
        h = (box[3] - box[1]) * scale,
        y = 792 - 28 - (box[3] - b[1]) * scale;
      page.drawText('X', {
        x: x + (w - font.widthOfTextAtSize('X', size)) / 2,
        y: y + (h - size) / 2 + 1,
        size,
        font,
      });
    }
  }
  doc.setTitle('GIL-F-014 Solicitud de bienes para uso de cuentadantes');
  doc.setAuthor('SENA CADPH');
  return doc.save();
}

const SHEET_NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const REL_NS = 'http://schemas.openxmlformats.org/package/2006/relationships';
const xmlParse = (text) => new DOMParser().parseFromString(text, 'application/xml');
const xmlText = (doc) => new XMLSerializer().serializeToString(doc);
function xmlCell(doc, address, value, numeric = false) {
  const rows = doc.getElementsByTagNameNS(SHEET_NS, 'row'),
    rowNum = address.match(/\d+/)[0];
  let row = Array.from(rows).find((r) => r.getAttribute('r') === rowNum);
  if (!row) {
    row = doc.createElementNS(SHEET_NS, 'row');
    row.setAttribute('r', rowNum);
    doc.getElementsByTagNameNS(SHEET_NS, 'sheetData')[0].appendChild(row);
  }
  let cell = [...children(row)].find((c) => c.getAttribute('r') === address);
  if (!cell) {
    cell = doc.createElementNS(SHEET_NS, 'c');
    cell.setAttribute('r', address);
    row.appendChild(cell);
    const col = (s) =>
      s
        .match(/[A-Z]+/)[0]
        .split('')
        .reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0);
    [...children(row)]
      .sort((a, b) => col(a.getAttribute('r')) - col(b.getAttribute('r')))
      .forEach((c) => row.appendChild(c));
  }
  for (const child of [...children(cell)])
    if (['f', 'v', 'is'].includes(child.localName)) child.parentNode.removeChild(child);
  if (value === '') {
    cell.removeAttribute('t');
    return cell;
  }
  if (numeric) {
    cell.removeAttribute('t');
    const v = doc.createElementNS(SHEET_NS, 'v');
    v.textContent = String(value);
    cell.appendChild(v);
  } else {
    cell.setAttribute('t', 'inlineStr');
    const is = doc.createElementNS(SHEET_NS, 'is'),
      t = doc.createElementNS(SHEET_NS, 't');
    t.setAttributeNS('http://www.w3.org/XML/1998/namespace', 'xml:space', 'preserve');
    t.textContent = String(value);
    is.appendChild(t);
    cell.appendChild(is);
  }
  return cell;
}
function originalValidations(doc) {
  let validations = doc.getElementsByTagNameNS(SHEET_NS, 'dataValidations')[0];
  if (!validations) {
    validations = doc.createElementNS(SHEET_NS, 'dataValidations');
    const root = doc.documentElement,
      before = [...children(root)].find((e) =>
        [
          'hyperlinks',
          'printOptions',
          'pageMargins',
          'pageSetup',
          'headerFooter',
          'drawing',
          'extLst',
        ].includes(e.localName),
      );
    root.insertBefore(validations, before || null);
  }
  for (const [address, formula] of [
    ['H14', '"MÚLTIPLE,UNIPERSONAL"'],
    ['H22', '"Area administrativa,Formación"'],
  ]) {
    const validation = doc.createElementNS(SHEET_NS, 'dataValidation');
    validation.setAttribute('type', 'list');
    validation.setAttribute('allowBlank', '1');
    validation.setAttribute('showErrorMessage', '1');
    validation.setAttribute('sqref', address);
    const f = doc.createElementNS(SHEET_NS, 'formula1');
    f.textContent = formula;
    validation.appendChild(f);
    validations.appendChild(validation);
  }
  validations.setAttribute('count', children(validations).length);
}
async function originalExcelBytes(data) {
  const zip = await JSZip.loadAsync(getTemplate().xlsx, { base64: true });
  const sourceSheet = await zip.file('xl/worksheets/sheet2.xml').async('string');
  const styles = xmlParse(await zip.file('xl/styles.xml').async('string')),
    styleRoot = styles.documentElement;
  let formats = styles.getElementsByTagNameNS(SHEET_NS, 'numFmts')[0];
  if (!formats) {
    formats = styles.createElementNS(SHEET_NS, 'numFmts');
    styleRoot.insertBefore(formats, styleRoot.firstChild);
  }
  const formatId = Math.max(
    164,
    ...[...children(formats)].map((e) => Number(e.getAttribute('numFmtId')) + 1),
  );
  const fmt = styles.createElementNS(SHEET_NS, 'numFmt');
  fmt.setAttribute('numFmtId', formatId);
  fmt.setAttribute('formatCode', 'dd/mm/yyyy');
  formats.appendChild(fmt);
  formats.setAttribute('count', children(formats).length);
  const xfs = styles.getElementsByTagNameNS(SHEET_NS, 'cellXfs')[0],
    dateSource = Array.from(xmlParse(sourceSheet).getElementsByTagNameNS(SHEET_NS, 'c')).find(
      (c) => c.getAttribute('r') === 'E10',
    );
  const dateStyle = children(xfs)[Number(dateSource?.getAttribute('s') || 0)].cloneNode(true);
  dateStyle.setAttribute('numFmtId', formatId);
  dateStyle.setAttribute('applyNumberFormat', '1');
  const dateStyleId = children(xfs).length;
  xfs.appendChild(dateStyle);
  xfs.setAttribute('count', children(xfs).length);
  zip.file('xl/styles.xml', xmlText(styles));
  const drawing = xmlParse(await zip.file('xl/drawings/drawing2.xml').async('string'));
  const drawingNS = 'http://schemas.openxmlformats.org/drawingml/2006/main';
  const selected = ['Pública', 'Pública Clasificada', 'Pública Reservada'].indexOf(
    data.classification,
  );
  for (const [i, name] of ['TextBox 5', 'TextBox 6', 'TextBox 7'].entries()) {
    const props = Array.from(drawing.getElementsByTagNameNS('*', 'cNvPr')).find(
      (n) => n.getAttribute('name') === name,
    );
    let shape = props;
    while (shape && shape.localName !== 'sp') shape = shape.parentNode;
    if (!shape) continue;
    const body = shape.getElementsByTagNameNS('*', 'txBody')[0];
    if (!body) continue;
    const paragraph = body.getElementsByTagNameNS(drawingNS, 'p')[0];
    for (const child of [...children(paragraph)])
      if (['r', 'br', 'fld'].includes(child.localName)) child.parentNode.removeChild(child);
    let pp = paragraph.getElementsByTagNameNS(drawingNS, 'pPr')[0];
    if (!pp) {
      pp = drawing.createElementNS(drawingNS, 'a:pPr');
      paragraph.insertBefore(pp, paragraph.firstChild);
    }
    pp.setAttribute('algn', 'ctr');
    const bp = body.getElementsByTagNameNS(drawingNS, 'bodyPr')[0];
    if (bp) bp.setAttribute('anchor', 'ctr');
    if (i === selected) {
      const run = drawing.createElementNS(drawingNS, 'a:r'),
        rp = drawing.createElementNS(drawingNS, 'a:rPr'),
        t = drawing.createElementNS(drawingNS, 'a:t');
      rp.setAttribute('sz', '1600');
      t.textContent = 'X';
      run.appendChild(rp);
      run.appendChild(t);
      paragraph.insertBefore(
        run,
        paragraph.getElementsByTagNameNS(drawingNS, 'endParaRPr')[0] || null,
      );
    }
  }
  zip.file('xl/drawings/drawing2.xml', xmlText(drawing));
  const pages = originalPages(data),
    workbook = xmlParse(await zip.file('xl/workbook.xml').async('string')),
    rels = xmlParse(await zip.file('xl/_rels/workbook.xml.rels').async('string')),
    types = xmlParse(await zip.file('[Content_Types].xml').async('string'));
  const sheets = workbook.getElementsByTagNameNS(SHEET_NS, 'sheets')[0],
    definedNames = workbook.getElementsByTagNameNS(SHEET_NS, 'definedNames')[0];
  const maxSheetId = Math.max(
    ...[...children(sheets)].map((sheet) => Number(sheet.getAttribute('sheetId'))),
  );
  const sourceRels = await zip.file('xl/worksheets/_rels/sheet2.xml.rels').async('string');
  for (let index = 0; index < pages.length; index++) {
    const doc = xmlParse(sourceSheet),
      cells = pages[index];
    for (const [address, value] of Object.entries(cells)) {
      const numeric = /^[BIJ](26|27|28|29|30|31)$/.test(address) && value !== '';
      xmlCell(doc, address, value, numeric);
    }
    const serial = Math.round(
        (Date.parse(data.date + 'T00:00:00Z') - Date.UTC(1899, 11, 30)) / 86400000,
      ),
      date = xmlCell(doc, 'E10', serial, true);
    date.setAttribute('s', dateStyleId);
    originalValidations(doc);
    const number = index === 0 ? 2 : index + 3,
      name = index === 0 ? 'FORMATO GIL-F-014' : `Solicitud ${index + 1}`,
      file = `xl/worksheets/sheet${number}.xml`;
    if (index > 0) {
      doc.documentElement.setAttributeNS(
        'http://schemas.microsoft.com/office/spreadsheetml/2014/revision',
        'xr:uid',
        '{' + crypto.randomUUID().toUpperCase() + '}',
      );
      for (const view of Array.from(doc.getElementsByTagNameNS(SHEET_NS, 'sheetView')))
        view.setAttribute('tabSelected', '0');
    }
    zip.file(file, xmlText(doc));
    if (index > 0) {
      const relationship = rels.createElementNS(REL_NS, 'Relationship'),
        relId = `rIdSolicitud${index + 1}`;
      relationship.setAttribute('Id', relId);
      relationship.setAttribute(
        'Type',
        'http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet',
      );
      relationship.setAttribute('Target', `worksheets/sheet${number}.xml`);
      rels.documentElement.appendChild(relationship);
      const sheet = workbook.createElementNS(SHEET_NS, 'sheet');
      sheet.setAttribute('name', name);
      sheet.setAttribute('sheetId', maxSheetId + index);
      sheet.setAttributeNS(
        'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
        'r:id',
        relId,
      );
      sheets.appendChild(sheet);
      const content = types.createElementNS(
        'http://schemas.openxmlformats.org/package/2006/content-types',
        'Override',
      );
      content.setAttribute('PartName', '/' + file);
      content.setAttribute(
        'ContentType',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml',
      );
      types.documentElement.appendChild(content);
      const drawingName = `drawingSolicitud${index + 1}.xml`,
        drawingFile = `xl/drawings/${drawingName}`;
      zip.file(drawingFile, xmlText(drawing));
      const drawingRels = zip.file('xl/drawings/_rels/drawing2.xml.rels');
      if (drawingRels)
        zip.file(`xl/drawings/_rels/${drawingName}.rels`, await drawingRels.async('uint8array'));
      const clonedRels = xmlParse(sourceRels);
      for (const rel of children(clonedRels.documentElement))
        if (rel.getAttribute('Type')?.endsWith('/drawing'))
          rel.setAttribute('Target', '../drawings/' + drawingName);
      zip.file(`xl/worksheets/_rels/sheet${number}.xml.rels`, xmlText(clonedRels));
      const drawingType = types.createElementNS(
        'http://schemas.openxmlformats.org/package/2006/content-types',
        'Override',
      );
      drawingType.setAttribute('PartName', '/' + drawingFile);
      drawingType.setAttribute(
        'ContentType',
        'application/vnd.openxmlformats-officedocument.drawing+xml',
      );
      types.documentElement.appendChild(drawingType);
    }
  }
  if (pages.length > 1) {
    zip.file('xl/workbook.xml', xmlText(workbook));
    zip.file('xl/_rels/workbook.xml.rels', xmlText(rels));
    zip.file('[Content_Types].xml', xmlText(types));
  }
  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
}

export { originalPdfBytes, originalExcelBytes };
