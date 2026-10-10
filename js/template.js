// Blank spreadsheet templates, derived from a layout's own elements so every
// layout (including new ones) gets a template with no extra work. Pure; Node-tested.

const ALWAYS = ['name', 'count', 'deck'];
// Images match cards by name, so the optional `art` column stays out of templates.
const LEFT_OUT = new Set(['art']);

const entryField = (entry) => (typeof entry === 'string' ? entry : entry?.field);

// Every column a layout reads, in the order it draws them.
export function layoutFields(layout) {
  const fields = [];
  for (const el of layout.elements) {
    if (el.type === 'image') fields.push(el.field || 'art');
    if (el.type !== 'text' || el.text != null) continue;
    if (el.parts) fields.push(...el.parts.map(entryField));
    else if (el.join) fields.push(...el.join.map(entryField));
    else if (el.field) fields.push(el.field);
  }
  // Columns that only switch elements on or off, or pick the card color.
  for (const el of layout.elements) fields.push(...[].concat(el.when || [], el.unless || []));
  if (layout.colorBy) fields.push(layout.colorBy.field);
  return [...new Set(fields.filter(Boolean))];
}

export function templateColumns(layout) {
  const columns = [...ALWAYS, ...layoutFields(layout).filter((f) => !LEFT_OUT.has(f))];
  if (!layout.colorBy) columns.push('color'); // otherwise the card color comes from colorBy
  return [...new Set(columns)];
}

const csvCell = (value) => (/[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);

// Header row only: a sample row could too easily end up in someone's deck.
export function templateCsv(layout) {
  return `${templateColumns(layout).map(csvCell).join(',')}\r\n`;
}
