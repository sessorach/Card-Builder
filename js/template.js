// Blank spreadsheet templates, derived from a layout's own elements so every
// layout (including new ones) gets a template with no extra work. Pure; Node-tested.

const ALWAYS = ['name', 'count', 'deck'];
// Images match cards by name, so the optional `art` column stays out of templates.
const LEFT_OUT = new Set(['art']);

const entryField = (entry) => (typeof entry === 'string' ? entry : entry?.field);
// A text element's entries, with inline groups ({ join: [...] }, nestable) flattened.
const flatEntries = (list) => (list || []).flatMap((e) => (e?.join ? flatEntries(e.join) : [e]));
const elementEntries = (el) => (el.parts ? flatEntries(el.parts) : el.join ? flatEntries(el.join) : [el]);

// Header notes for list columns (one cell, several items). The page ignores
// anything in parentheses when it reads a header, so the note is safe to keep.
const LIST_NOTE = '(separate with commas)';

// Every column a layout reads, in the order it draws them.
// A layout's elements with stacks opened up (their items' elements, plus the items
// themselves so their when/unless columns count).
const allElements = (elements) =>
  elements.flatMap((el) => (el.type === 'stack' ? [el, ...el.items.flatMap((item) => [item, ...allElements(item.elements)])] : [el]));

export function layoutFields(layout) {
  const fields = [];
  const elements = allElements(layout.elements);
  for (const el of elements) {
    if (el.type === 'image') fields.push(el.field || 'art');
    if (el.type === 'blend') fields.push(el.field, el.styleField, el.override);
    if (el.type !== 'text' || el.text != null) continue;
    fields.push(...elementEntries(el).map(entryField));
  }
  // Columns that only switch elements on or off, or pick the card color.
  for (const el of elements) {
    fields.push(...[].concat(el.when || [], el.unless || [], el.whenAll || [], el.unlessAll || []), el.whenHas?.field, el.unlessHas?.field);
  }
  if (layout.colorBy) fields.push(layout.colorBy.field);
  return [...new Set(fields.filter(Boolean))];
}

// Columns a layout shows as a list (`list: true`), e.g. tags.
export function listFields(layout) {
  const fields = new Set();
  for (const el of allElements(layout.elements)) {
    if (el.type !== 'text') continue;
    for (const entry of elementEntries(el)) if (entry?.list && entryField(entry)) fields.add(entryField(entry));
  }
  return fields;
}

export function templateColumns(layout) {
  const columns = [...ALWAYS, ...layoutFields(layout).filter((f) => !LEFT_OUT.has(f))];
  if (!layout.colorBy) columns.push('color'); // otherwise the card color comes from colorBy
  return [...new Set(columns)];
}

const csvCell = (value) => (/[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);

// Header row only: a sample row could too easily end up in someone's deck.
export function templateCsv(layout) {
  const lists = listFields(layout);
  const headers = templateColumns(layout).map((col) => (lists.has(col) ? `${col} ${LIST_NOTE}` : col));
  return `${headers.map(csvCell).join(',')}\r\n`;
}
