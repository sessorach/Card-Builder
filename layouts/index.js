// Layout registry. To add a layout: create a file in this folder (copy an
// existing one) and add it to this list. Nothing else needs to change.
import classic from './classic.js';
import fullArt from './full-art.js';
import textOnly from './text-only.js';

export const LAYOUTS = [classic, fullArt, textOnly];

export function getLayout(id) {
  return LAYOUTS.find((l) => l.id === id) || null;
}
