// FlagonQuest Technique: a reference card for a FlagonQuest technique, styled
// like the technique tiles on the FlagonQuest site (dark navy panel, gold
// labels, MedievalSharp name). It reads FlagonQuest's own techniques
// spreadsheet as-is: drop in scripts/techniques.csv from the flagonquest repo.
//
// Columns used: name, level_min, level_max, tags, action, cost, condition,
// target, text (the sheet's "Effects"), choice_effects (one line per option, e.g.
// Profession), special, prereqs, flavor (the sheet's
// "Description (Fluff)", shown on hover only).

// The FlagonQuest site's palette.
const PAGE = '#0a0e18';
const CARD = '#161b27';
const PANEL = '#0d1117';
const LINE = '#2d3555';
const NAME = '#e8dfc8';
const BODY = '#d3c9a3';
const LABEL = '#a68f52';
const MUTED = '#9c9576';

const labelled = (field, label) => ({ field, label, labelColor: LABEL });

export default {
  id: 'flagonquest-technique',
  name: 'FlagonQuest Technique',
  description: 'FlagonQuest technique reference card. Drop in the techniques spreadsheet from the FlagonQuest repo as-is.',
  defaultColor: '#d4a843',
  // Picked automatically when a spreadsheet has these columns (and no layout column).
  matchColumns: ['level_min', 'action', 'prereqs'],
  fonts: {
    title: { font: 'medievalsharp', weight: 400, boldWeight: 400 },
    body: { font: 'barlow', weight: 500, boldWeight: 700 },
  },
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
    { type: 'rect', x: 0, y: 0, w: 100, h: 100, fill: PAGE },
    { type: 'rect', x: 2.5, y: 1.8, w: 95, h: 96.4, fill: CARD, texture: 'grit', textureStrength: 0.3, stroke: 'accent', strokeWidth: 0.5, radius: 2.5 },

    // Name and level badge.
    { type: 'text', field: 'name', x: 6, y: 3.6, w: 65, h: 8.4, font: 'title', size: 7.2, minSize: 4, color: NAME, valign: 'middle' },
    { when: 'level_min', type: 'rect', x: 73, y: 4.4, w: 21, h: 6.6, fill: '#24221a', stroke: '#5b5540', strokeWidth: 0.3, radius: 1 },
    {
      when: 'level_min', type: 'text', join: [{ field: 'level_min', prefix: 'Lv ' }, 'level_max'], sep: '–', unique: true,
      x: 73, y: 4.4, w: 21, h: 6.6, font: 'body', size: 4.8, minSize: 3, color: NAME, align: 'center', valign: 'middle',
    },

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
    { type: 'rect', x: 6, y: 18.8, w: 88, h: 0.25, fill: 'accent', opacity: 0.55 },

    // The rules: labelled lines, then the effects.
    {
      type: 'text',
      parts: [labelled('action', 'Action'), labelled('cost', 'Cost'), labelled('condition', 'Condition'), labelled('target', 'Target'), 'text', 'choice_effects', labelled('special', 'Special')],
      x: 6, y: 20.8, w: 88, h: 66.4, font: 'body', size: 5, minSize: 2.4, lineHeight: 1.22, color: BODY, valign: 'top',
    },

    // Prereqs footer.
    { when: 'prereqs', type: 'rect', x: 4.5, y: 88.6, w: 91, h: 7.8, fill: PANEL, stroke: LINE, strokeWidth: 0.3, radius: 1.2 },
    {
      when: 'prereqs', type: 'text', ...labelled('prereqs', 'Prereqs'),
      x: 7, y: 88.8, w: 86, h: 7.4, font: 'body', size: 3.8, minSize: 2.2, color: MUTED, valign: 'middle',
    },
  ],
};
