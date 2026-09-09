import zipfile, xml.etree.ElementTree as ET, json, sys
ns={'m':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
for path in sys.argv[1:]:
 with zipfile.ZipFile(path) as z:
  ss=[]
  if 'xl/sharedStrings.xml' in z.namelist():
   ss=[''.join(n.itertext()) for n in ET.fromstring(z.read('xl/sharedStrings.xml'))]
  print('FILE',path.split('/')[-1])
  print(z.read('xl/workbook.xml').decode()[:2500])
  for name in z.namelist():
   if name.startswith('xl/worksheets/sheet') and name.endswith('.xml'):
    root=ET.fromstring(z.read(name)); print('SHEET',name)
    for row in root.findall('m:sheetData/m:row',ns):
     if 'INVENTARIO SENA' in path and row.attrib['r']!='4': continue
     cells=[]
     for c in row:
      v=c.find('m:v',ns)
      text=v.text if v is not None else ''.join(c.find('m:is',ns).itertext()) if c.find('m:is',ns) is not None else ''
      if c.attrib.get('t')=='s' and text: text=ss[int(text)]
      if text: cells.append(c.attrib['r']+'='+text)
     if cells: print(' | '.join(cells))
    if 'INVENTARIO SENA' not in path: print('MERGES',[n.attrib['ref'] for n in root.findall('m:mergeCells/m:mergeCell',ns)])
