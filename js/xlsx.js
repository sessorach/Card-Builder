// Minimal .xlsx reader: an .xlsx file is a zip of XML, so JSZip + DOMParser is
// enough to pull the first worksheet's cell text. Avoids shipping SheetJS.
// Browser-only (uses the global JSZip and DOMParser).

const byTag = (node, name) => Array.from(node.getElementsByTagNameNS('*', name));

function parseXml(text) {
  return new DOMParser().parseFromString(text, 'application/xml');
}

function columnIndex(ref) {
  const letters = /^[A-Z]+/i.exec(ref || '')?.[0].toUpperCase() || '';
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

// Concatenates every <t> under a node (rich text splits a cell into runs).
function textOf(node) {
  return byTag(node, 't').map((t) => t.textContent).join('');
}

async function firstSheetPath(zip) {
  const workbook = await zip.file('xl/workbook.xml')?.async('string');
  const rels = await zip.file('xl/_rels/workbook.xml.rels')?.async('string');
  if (workbook && rels) {
    const sheet = byTag(parseXml(workbook), 'sheet')[0];
    const relId =
      sheet?.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id') ||
      sheet?.getAttribute('r:id');
    const rel = byTag(parseXml(rels), 'Relationship').find((r) => r.getAttribute('Id') === relId);
    const target = rel?.getAttribute('Target');
    if (target) return target.startsWith('/') ? target.slice(1) : `xl/${target}`;
  }
  return 'xl/worksheets/sheet1.xml';
}

export async function readXlsx(arrayBuffer) {
  const zip = await JSZip.loadAsync(arrayBuffer);
  const sharedXml = await zip.file('xl/sharedStrings.xml')?.async('string');
  const shared = sharedXml ? byTag(parseXml(sharedXml), 'si').map(textOf) : [];

  const sheetFile = zip.file(await firstSheetPath(zip));
  if (!sheetFile) throw new Error("Couldn't find a worksheet in this .xlsx file.");
  const sheet = parseXml(await sheetFile.async('string'));

  const rows = [];
  for (const rowEl of byTag(sheet, 'row')) {
    const rowIdx = Number(rowEl.getAttribute('r')) - 1;
    const row = [];
    for (const c of byTag(rowEl, 'c')) {
      const type = c.getAttribute('t');
      const v = byTag(c, 'v')[0]?.textContent ?? '';
      let value;
      if (type === 's') value = shared[Number(v)] ?? '';
      else if (type === 'inlineStr') value = textOf(c);
      else if (type === 'b') value = v === '1' ? 'TRUE' : 'FALSE';
      else value = v;
      const ref = c.getAttribute('r');
      row[ref ? columnIndex(ref) : row.length] = value;
    }
    rows[Number.isFinite(rowIdx) && rowIdx >= 0 ? rowIdx : rows.length] = Array.from(row, (x) => x ?? '');
  }
  return Array.from(rows, (r) => r ?? []);
}
