// FlagonQuest Technique: a reference card for a FlagonQuest technique, styled
// like the technique tiles on the FlagonQuest site (dark navy panel, gold
// labels, MedievalSharp name). It reads FlagonQuest's own techniques
// spreadsheet as-is: drop in scripts/techniques.csv from the flagonquest repo.
//
// Columns used: name, level_min, level_max, tags, action, cost, condition,
// target, text (the sheet's "Effects"), choice_effects (one line per option, e.g.
// Profession), special, prereqs, flavor (the sheet's "Description (Fluff)",
// shown on hover only).
import { BODY, MUTED, GOLD, FONTS, labelled, frameAndName, divider, footer } from './flagonquest-common.js';

export default {
  id: 'flagonquest-technique',
  name: 'FlagonQuest Technique',
  description: 'FlagonQuest technique reference card. Drop in the techniques spreadsheet from the FlagonQuest repo as-is.',
  defaultColor: GOLD,
  // Picked automatically when a spreadsheet has these columns (and no layout column).
  matchColumns: ['level_min', 'action', 'prereqs'],
  fonts: FONTS,
  // What TTS shows when you hover over the card.
  hover: [
    labelled('tags', 'Tags'),
    labelled('action', 'Action'),
    labelled('cost', 'Cost'),
    labelled('condition', 'Condition'),
    labelled('target', 'Target'),
    'text',
    'choice_effects',
    labelled('special', 'Special'),
    labelled('prereqs', 'Prereqs'),
    { field: 'flavor', italic: true },
  ],
  elements: [
    // Name and level badge ("Lv 1–4", or "Lv 1" when both ends match).
    ...frameAndName({ when: 'level_min', join: [{ field: 'level_min', prefix: 'Lv ' }, 'level_max'], sep: '–', unique: true }),

    // Tags, with Encounter pulled out into its own orange badge like on the site.
    {
      type: 'text', field: 'tags', list: true, exclude: ['Encounter'], itemColors: { Buildable: '#7F77DD', Duplicate: '#1D9E75' },
      x: 6, y: 12.2, w: 62, h: 5.4, font: 'body', weight: 'bold', size: 3.9, minSize: 2.6, color: MUTED, valign: 'middle',
    },
    { whenHas: { field: 'tags', value: 'Encounter' }, type: 'rect', x: 70, y: 12.2, w: 24, h: 5.4, fill: '#2a1a00', stroke: '#a0672e', strokeWidth: 0.3, radius: 1 },
    {
      whenHas: { field: 'tags', value: 'Encounter' }, type: 'text', text: 'Encounter',
      x: 70, y: 12.2, w: 24, h: 5.4, font: 'body', weight: 'bold', size: 3.9, minSize: 2.6, color: '#e6943a', align: 'center', valign: 'middle',
    },
    divider,

    // The rules: labelled lines, then the effects.
    {
      type: 'text',
      parts: [labelled('action', 'Action'), labelled('cost', 'Cost'), labelled('condition', 'Condition'), labelled('target', 'Target'), 'text', 'choice_effects', labelled('special', 'Special')],
      x: 6, y: 20.8, w: 88, h: 66.4, font: 'body', size: 5, minSize: 2.4, lineHeight: 1.22, color: BODY, valign: 'top',
    },

    ...footer(labelled('prereqs', 'Prereqs')),
  ],
};
