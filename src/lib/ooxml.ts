import JSZip from 'jszip';
// ExcelJS does not retain DrawingML text boxes. Restore the official drawing parts
// after cell editing, removing the sample handwritten signature and classification X.
export async function preserveDrawings(source: Buffer, edited: Buffer, cleanSample = false) {
  const original = await JSZip.loadAsync(source),
    target = await JSZip.loadAsync(edited);
  for (const name of Object.keys(target.files))
    if (name.startsWith('xl/drawings/') || name.startsWith('xl/media/')) target.remove(name);
  for (const name of Object.keys(original.files)) {
    if (
      original.files[name].dir ||
      (!name.startsWith('xl/drawings/') && !name.startsWith('xl/media/'))
    )
      continue;
    if (cleanSample && name === 'xl/media/image2.jpeg') continue;
    let content = await original.file(name)!.async('nodebuffer');
    if (cleanSample && name === 'xl/drawings/drawing1.xml') {
      const xml = content
        .toString()
        .replace(/<xdr:twoCellAnchor\b[\s\S]*?<\/xdr:twoCellAnchor>/g, (anchor) =>
          anchor.includes('<xdr:pic>') && anchor.includes('r:embed="rId2"')
            ? ''
            : anchor.replace(/<a:t>[^<]*<\/a:t>/g, '<a:t> </a:t>'),
        );
      content = Buffer.from(xml);
    }
    if (cleanSample && name.endsWith('drawing1.xml.rels'))
      content = Buffer.from(
        content.toString().replace(/<Relationship\b[^>]*Id="rId2"[^>]*\/>/g, ''),
      );
    target.file(name, content);
  }
  return target.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}
