// Layout registry. To add a layout: create a file in this folder (copy an
// existing one) and add it to this list. Nothing else needs to change.
import defaultLayout from './default.js';
import fullArt from './full-art.js';
import textOnly from './text-only.js';
import street from './street.js';
import flagonquest from './flagonquest.js';

export const LAYOUTS = [defaultLayout, fullArt, textOnly, street, flagonquest];

// By id, or by an old id listed in a layout's `aliases` (so renamed layouts keep working).
export function getLayout(id) {
  return LAYOUTS.find((l) => l.id === id) || LAYOUTS.find((l) => l.aliases?.includes(id)) || null;
}

// matchColumns is one list of columns, or several lists (any one of them matches).
export function matchesColumns(layout, columns) {
  const m = layout.matchColumns;
  if (!m?.length) return false;
  const sets = Array.isArray(m[0]) ? m : [m];
  return sets.some((set) => set.every((c) => columns.includes(c)));
}
