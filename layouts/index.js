// Layout registry. To add a layout: create a file in this folder (copy an
// existing one) and add it to this list. Nothing else needs to change.
import defaultLayout from './default.js';
import fullArt from './full-art.js';
import textOnly from './text-only.js';
import street from './street.js';
import flagonquestTechnique from './flagonquest-technique.js';

export const LAYOUTS = [defaultLayout, fullArt, textOnly, street, flagonquestTechnique];

export function getLayout(id) {
  return LAYOUTS.find((l) => l.id === id) || null;
}
