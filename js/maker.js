// The Card maker: a form that builds a spreadsheet one card at a time. This module
// is the pure part (which boxes a look needs, which ones apply to the card being
// made, the color-blend picker's rows, writing the CSV); js/maker-ui.js draws the
// form. Node-tested.

import { templateColumns, listFields } from './template.js';
import { shows } from './render.js';
import { parseBlend } from './blend.js';

// Columns written in a big box rather than a one-line one.
const LONG = new Set(['text', 'flavor', 'choice_effects', 'built_features', 'picks', 'powers', 'special', 'crit']);

// "to_hit" → "To hit", "w" → "[W]".
export function fieldLabel(column) {
  if (column === 'w') return '[W]';
  const words = column.replace(/_/g, ' ');
  return words[0].toUpperCase() + words.slice(1);
}

// A layout's elements, each with the conditions it sits under (its stack's and its
// stack item's, which `shows` checks the same way as the element's own).
function placed(elements, chain = []) {
  return elements.flatMap((el) => {
    if (el.type !== 'stack') return [{ el, chain }];
    return el.items.flatMap((item) => placed(item.elements, [...chain, el, item]));
  });
}

const entryField = (entry) => (typeof entry === 'string' ? entry : entry?.field);
const flat = (list) => (list || []).flatMap((e) => (e?.join ? flat(e.join) : [e]));
// The columns an element draws (not the ones that only switch it on or off).
function drawnFields(el) {
  if (el.type === 'image') return [el.field || 'art'];
  if (el.type === 'blend') return [el.field, el.styleField].filter(Boolean);
  if (el.type !== 'text' || el.text != null) return [];
  return (el.parts ? flat(el.parts) : el.join ? flat(el.join) : [el]).map(entryField).filter(Boolean);
}

// Which boxes the form shows: the look's columns, each with the kind of box it needs.
//   kind: 'text' (one line), 'long' (several lines), 'list' (comma-separated),
//   'blend' (weighted colors, e.g. RossQuest's aura), 'style' (a blend style),
//   'color' (a color name or code, with a picker).
// options: suggested values, from conditions that test for a value (RossQuest's
// type "Action"); choices: a fixed list from the layout's `form` hints, shown as a
// drop-down. Columns that switch other parts of the card on or off (`switches`,
// e.g. RossQuest's type) come right after the name, since they decide which other
// boxes apply, unless the layout gives its own `formOrder`.
export function formFields(layout) {
  const lists = listFields(layout);
  const blends = placed(layout.elements).map((p) => p.el).filter((el) => el.type === 'blend');
  const suggestions = {};
  const suggest = (field, values) => {
    if (!field) return;
    suggestions[field] = [...new Set([...(suggestions[field] || []), ...[].concat(values)])];
  };
  for (const { el, chain } of placed(layout.elements)) {
    for (const c of [el, ...chain]) {
      for (const has of [c.whenHas, c.unlessHas]) if (has) suggest(has.field, has.value);
    }
  }
  for (const [field, hint] of Object.entries(layout.form || {})) if (hint.options) suggest(field, hint.options);
  const switching = new Set();
  for (const { el, chain } of placed(layout.elements)) {
    for (const c of [el, ...chain]) {
      for (const f of [].concat(c.when || [], c.unless || [], c.whenAll || [], c.unlessAll || [], c.whenHas?.field || [], c.unlessHas?.field || [])) switching.add(f);
    }
  }
  const fields = templateColumns(layout).map((column) => {
    const blend = blends.find((el) => el.field === column);
    if (blend) return { column, kind: 'blend', colors: blend.colors || {}, modifiers: blend.modifiers || {} };
    if (blends.some((el) => el.styleField === column)) return { column, kind: 'style' };
    if (column === 'color') return { column, kind: 'color' };
    const kind = LONG.has(column) ? 'long' : lists.has(column) ? 'list' : 'text';
    // A column whose own value turns parts on or off; one that's only tested for
    // having a value (Immunities shows its strip when filled) doesn't count.
    const switches = switching.has(column) && (!!suggestions[column] || !!layout.form?.[column]?.switches);
    return { column, kind, options: suggestions[column] || [], choices: layout.form?.[column]?.choices || [], switches };
  });
  // A layout's `formOrder` puts the columns it names first, in that order.
  if (layout.formOrder) {
    const at = (f) => (layout.formOrder.includes(f.column) ? layout.formOrder.indexOf(f.column) : Infinity);
    return fields.map((f, i) => [f, i]).sort((a, b) => at(a[0]) - at(b[0]) || a[1] - b[1]).map(([f]) => f);
  }
  const first = fields.filter((f) => f.column === 'name');
  const switches = fields.filter((f) => f.switches);
  return [...first, ...switches, ...fields.filter((f) => !first.includes(f) && !switches.includes(f))];
}

// The columns that would show on this card, given what's filled in so far. A column
// counts when some element drawing it would show if it had a value, so filling in
// one box (type: Action) can switch others on or off. Columns that nothing draws
// (they only switch elements on or off) always count, as do name, count and deck.
export function visibleFields(layout, fields) {
  const visible = new Set(['name', 'count', 'deck', 'color']);
  const drawn = new Set();
  for (const { el, chain } of placed(layout.elements)) {
    for (const field of drawnFields(el)) {
      drawn.add(field);
      const probe = { fields: { ...fields, [field]: fields[field] || 'x' } };
      if ([...chain, el].every((c) => shows(probe, c))) visible.add(field);
    }
  }
  for (const column of templateColumns(layout)) if (!drawn.has(column)) visible.add(column);
  return visible;
}

const capital = (word) => word[0].toUpperCase() + word.slice(1);

// A blend cell ("Knowledge 2, Inverted Passion") as rows for the picker:
// [{ color: 'Knowledge', weight: 2, modifiers: [] }, { color: 'Passion', weight: null, modifiers: ['Inverted'] }].
// weight is null when the item gives no number (an even share; the card shows just the name).
// Colors and modifiers come back spelled as the layout spells them.
export function blendRows(value, colors, modifiers = {}) {
  const spell = (obj, key) => Object.keys(obj).find((k) => k.toLowerCase() === key) || key;
  return parseBlend(value, colors, modifiers).map((p) => ({
    color: capital(spell(colors, p.key)),
    weight: p.weighted ? p.weight : null,
    modifiers: p.modifiers.map((m) => capital(spell(modifiers, m))),
  }));
}

// The picker's rows back as a cell. A blank weight (null or '') writes just the name,
// which counts as an even share of 1; any number given is written, 1 included, so
// the card's Aura boxes show it. A weight of 0 leaves the row out.
export function blendText(rows) {
  const blank = (w) => w == null || w === '';
  return rows
    .filter((r) => r.color && (blank(r.weight) || Number(r.weight) > 0))
    .map((r) => [...(r.modifiers || []), r.color, blank(r.weight) ? '' : String(Number(r.weight))].join(' ').trim())
    .join(', ');
}

const csvCell = (value) => {
  const text = String(value ?? '');
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

// rows: [{ column: value }]. Columns no row fills in are left out, except name.
export function rowsToCsv(columns, rows) {
  const used = columns.filter((c) => c === 'name' || rows.some((r) => String(r[c] ?? '').trim() !== ''));
  return [used, ...rows.map((r) => used.map((c) => r[c] ?? ''))].map((line) => line.map(csvCell).join(',')).join('\r\n') + '\r\n';
}
