// Street: graffiti-style card. Name at the top over big art, a "$" cost sticker,
// a rules box, a type bar ("TYPE — tag · tag · tag") and a stat row.
// Thugs show three stats in the stat row; Bling shows its equip cost there.
// Cards with neither drop the stat row and the rules box grows to fill the
// space, so all cards keep the same overall shape.
//
// Columns: name, cost, art, text, flavor, type, tags (comma-separated),
// strengf, helf, steal, equip_cost.

// The three Thug stats, left to right. Spellings are the game's own; keep them.
const STATS = [
  { field: 'strengf', label: 'STRENGF' },
  { field: 'helf', label: 'HELF' },
  { field: 'steal', label: 'STEAL' },
];
const THUG_FIELDS = STATS.map((s) => s.field);

// Bling's equip cost: one stat box in the middle slot, shown with "$" like the cost.
const EQUIP = { field: 'equip_cost', label: 'EQUIP COST', prefix: '$' };

// Any of these filled in → the card gets a stat row.
const STAT_FIELDS = [...THUG_FIELDS, EQUIP.field];

const INK = '#16151a';
const PANEL = '#24222b';
const NAME_BAR = '#1d1b22';
const PAPER = '#f3e9d2';
const PAPER_INK = '#16151a';
const WHITE = '#fbf8f1';

// Surfaces: worn paper for the rules box, spray-paint grit for bars and boxes.
const GRIT = { texture: 'grit', bevel: true };
const PAPER_SURFACE = { texture: 'paper', bevel: 0.5 };

// Rules box + type bar. With stats they sit above the stat row; without, they
// stretch down to the bottom edge.
function bottomSection(hasStats) {
  const condition = hasStats ? { when: STAT_FIELDS } : { unless: STAT_FIELDS };
  const textBottom = hasStats ? 79 : 89.5;
  const barY = hasStats ? 80.2 : 90.7;
  return [
    { ...condition, type: 'rect', x: 4, y: 58.8, w: 92, h: textBottom - 58.8, fill: PAPER, ...PAPER_SURFACE, stroke: '#000', strokeWidth: 0.6, radius: 1.6 },
    {
      ...condition,
      type: 'text',
      parts: ['text', { field: 'flavor', italic: true }],
      x: 7, y: 59.9, w: 86, h: textBottom - 61,
      font: 'body', size: 5.4, minSize: 3, lineHeight: 1.16, color: PAPER_INK, valign: 'middle',
    },
    { ...condition, type: 'rect', x: 4, y: barY, w: 92, h: 6.3, fill: 'accent', ...GRIT, stroke: '#000', strokeWidth: 0.6, radius: 1.2 },
    {
      ...condition,
      type: 'text',
      join: ['type', { field: 'tags', list: true, listSep: ' · ' }],
      sep: ' — ',
      x: 6.5, y: barY + 0.2, w: 87, h: 6.1,
      font: 'label', size: 5.8, minSize: 3.4, color: 'onAccent', valign: 'middle', baseline: 0.36,
    },
  ];
}

const ROW = { y: 87.3, h: 9.9, w: 29, gap: 2.5 };
const slotX = (i) => 4 + i * (ROW.w + ROW.gap);

// One stat box: label on top, big number below, both in the drippy stat font.
function statBox(x, { field, label, prefix }, extra = {}) {
  const { y, h, w } = ROW;
  return [
    { ...extra, type: 'rect', x, y, w, h, fill: PANEL, ...GRIT, stroke: 'accent', strokeWidth: 0.6, radius: 1.6 },
    { ...extra, type: 'text', text: label, x, y: y + 0.3, w, h: 2.6, font: 'stat', size: 3.1, minSize: 2.4, color: 'accentLight', align: 'center', valign: 'middle', baseline: 0.34 },
    {
      ...extra, type: 'text', field, prefix, x, y: y + 3.1, w, h: 6.4,
      font: 'stat', size: 8, minSize: 4, lineHeight: 0.85, color: WHITE, align: 'center', valign: 'middle', baseline: 0.24,
      outline: '#000', outlineWidth: 0.045, shadow: { color: 'accent', x: 0.05, y: 0.05 },
    },
  ];
}

function statBoxes() {
  return STATS.flatMap((stat, i) => [
    // Full strength when the card has this stat; faded (with no number) when it doesn't.
    ...statBox(slotX(i), stat, { when: stat.field }),
    ...statBox(slotX(i), { ...stat, field: undefined }, { when: THUG_FIELDS, unless: stat.field, opacity: 0.35 }),
  ]);
}

function equipBox() {
  return statBox(slotX(1), EQUIP, { when: EQUIP.field });
}

export default {
  id: 'street',
  name: 'Street',
  description: 'Graffiti style: name bar, uncropped art, $ cost, type bar with tags, stat row for Thugs and Bling.',
  defaultColor: '#ffcc1a',
  // Card color comes from the type (a `color` column on a card still overrides it).
  colorBy: {
    field: 'type',
    colors: {
      Thug: '#8a5cf5', // funky purple
      Bling: '#d4a72c', // gold
      Negromancy: '#34323b', // dusky black: dark gray, so the frame still reads
      'Dropped Move': '#6cc24a', // green
    },
  },
  fonts: {
    title: { font: 'permanent-marker', weight: 400, boldWeight: 400 },
    cost: { font: 'sedgwick', weight: 400, boldWeight: 400 },
    body: { font: 'barlow', weight: 500, boldWeight: 700 },
    label: { font: 'bebas', weight: 400, boldWeight: 400 },
    stat: { font: 'rubik-wet-paint', weight: 400, boldWeight: 400 },
  },
  elements: [
    { type: 'rect', x: 0, y: 0, w: 100, h: 100, fill: INK, texture: 'grit', textureStrength: 0.7 },
    { type: 'rect', x: 1.8, y: 1.3, w: 96.4, h: 97.4, stroke: 'accent', strokeWidth: 0.9, radius: 3 },

    // Name bar: solid, above the art.
    { type: 'rect', x: 4, y: 3, w: 92, h: 9.4, fill: NAME_BAR, ...GRIT, stroke: '#000', strokeWidth: 0.6, radius: 1.6 },
    {
      type: 'text', field: 'name', x: 6.5, y: 3.2, w: 67, h: 9, rotate: -2,
      font: 'title', size: 8.6, minSize: 4.5, color: WHITE, valign: 'middle',
      outline: '#000', outlineWidth: 0.1, shadow: { color: 'accent', x: 0.07, y: 0.07 },
    },

    // Cost sticker: "$" + number.
    { when: 'cost', type: 'rect', x: 76.5, y: 3.8, w: 17, h: 8.2, rotate: 6, fill: 'accent', ...GRIT, stroke: '#000', strokeWidth: 0.8, radius: 1.8 },
    {
      when: 'cost', type: 'text', field: 'cost', prefix: '$', x: 76.5, y: 3.8, w: 17, h: 8.2, rotate: 6,
      font: 'cost', size: 8, minSize: 4, color: 'onAccent', align: 'center', valign: 'middle',
    },

    // Art: the whole picture, never cropped; odd shapes are letterboxed on a dark panel.
    {
      type: 'image', field: 'art', x: 4, y: 13.4, w: 92, h: 44.2, radius: 1.6, stroke: '#000', strokeWidth: 0.6,
      fit: 'contain', background: PANEL, texture: 'grit', textureStrength: 0.6,
    },

    ...bottomSection(true),
    ...bottomSection(false),
    ...statBoxes(),
    ...equipBox(),
  ],
};
