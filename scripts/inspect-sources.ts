import ExcelJS from 'exceljs';
const inventory = new ExcelJS.Workbook();
await inventory.xlsx.readFile(process.argv[2]);
for (const sheet of inventory.worksheets) {
  const counts = new Map<string, number>();
  let rows = 0;
  let missing = 0;
  sheet.eachRow((row, n) => {
    if (n < 5) return;
    if (!row.getCell(3).text.trim()) return;
    rows++;
    const p = row.getCell(11).text.trim();
    if (!p || p === 'N/A') {
      missing++;
      return;
    }
    counts.set(p, (counts.get(p) || 0) + 1);
  });
  console.log(
    JSON.stringify({
      sheet: sheet.name,
      rows,
      missing,
      duplicates: [...counts.values()].filter((n) => n > 1).length,
      headers: sheet.getRow(4).values,
    }),
  );
}
const template = new ExcelJS.Workbook();
await template.xlsx.readFile(process.argv[3]);
for (const sheet of template.worksheets) {
  console.log(
    'TEMPLATE',
    sheet.name,
    JSON.stringify(sheet.model.merges),
    'images',
    sheet.getImages().length,
  );
  sheet.eachRow((row) => {
    const cells: string[] = [];
    row.eachCell((c) => {
      if (c.address === c.master.address) cells.push(`${c.address}=${c.text}`);
    });
    console.log(cells.join(' | '));
  });
}
