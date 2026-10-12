// Allies (working name): characters and the actions they take, in one layout
// with a variant per card type. Draft.
//
// The background is the card's Aura: each aura word is a color, its number is its
// share of the card ("Instinct 2, Knowledge 1" is two-thirds green), and an aura
// marked Inverted blights its share: a darker, sickly, veined version of that
// color. A `blend` column picks the style per card: gradient (default), split,
// tie-dye, marble or solid.
//
// Columns: name, type (Ally or Action), tags, aura, text (abilities), flavor, blend,
// art (optional; images match by card name). Allies: armor, health, resists,
// immunities. Actions: to_hit, w (a "[W]" header works too; the weapon damage die), damage,
// crit (can be a sentence), skill_check (non-attacks: "Acrobatics 10 + 1d6, with
// Advantage"), range, usage.

import { partRgb } from '../js/blend.js';

// Aura colors. Keys are the words looked for in the aura cell (any capitalization).
const AURA = {
  instinct: '#2f8f55',
  knowledge: '#2c69b8',
  passion: '#c23b2c',
  discipline: '#ece4cf',
};
// "Inverted Passion" or "Passion (Inverted)": a blighted version of that color —
// duller and darker, with a bilious cast and dark veins through its share.
const BLIGHT = '#4a5a12';
const MODIFIERS = { inverted: { saturate: 0.92, darken: 0.26, mix: BLIGHT, amount: 0.14, mottle: 0.5 } };

const INK = '#17130f';
const NAME = '#f1e6cc';
const TEXT = '#2b241c';
const LABEL = '#7a5a2a';

// Aura chips in the text box, colored like the background they make. An Inverted
// aura's chip is that aura's blighted color.
const hex = (rgb) => `#${rgb.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
const blighted = (color) => hex(partRgb({ color, modifiers: ['inverted'] }, MODIFIERS));
const AURA_CHIPS = {
  'inverted instinct': { fill: blighted(AURA.instinct), stroke: '#9aab55', color: '#d6e09c' },
  'inverted knowledge': { fill: blighted(AURA.knowledge), stroke: '#9aab55', color: '#d6e09c' },
  'inverted passion': { fill: blighted(AURA.passion), stroke: '#9aab55', color: '#d6e09c' },
  'inverted discipline': { fill: blighted(AURA.discipline), stroke: '#9aab55', color: '#eef2cf' },
  instinct: { fill: AURA.instinct, stroke: '#1d5c37', color: '#ffffff' },
  knowledge: { fill: AURA.knowledge, stroke: '#1c4478', color: '#ffffff' },
  passion: { fill: AURA.passion, stroke: '#7d2219', color: '#ffffff' },
  discipline: { fill: AURA.discipline, stroke: '#8a7f66', color: '#3a3226' },
};

const labelled = (field, label) => ({ field, label, labelColor: LABEL });

// See-through panels, so the aura shows behind the name, type line and text.
const GLASS_DARK = 'rgba(23, 19, 15, 0.7)';
const GLASS_PAPER = 'rgba(239, 230, 208, 0.82)';
const PANEL = { type: 'rect', fill: GLASS_PAPER, texture: 'paper', textureStrength: 0.6, radius: 1.2 };

// Which card type an element belongs to. A row is an Action when its type says so;
// anything else is drawn as an Ally.
const ACTION = { field: 'type', value: 'Action' };
const ALLY_ONLY = { unlessHas: ACTION };
const ACTION_ONLY = { whenHas: ACTION };

// The ally bottom row: Armor, the Aura boxes, Health.
const ROW_Y = 87.8;
const ROW_H = 8.6;
const LEFT = 5;
const RIGHT = 77;
// minSize lets a wordy value ("Once per battle") shrink and wrap to fit; valueStyle
// can change the value's font (dice keep their lowercase "d" in the body font, since
// the title font has only capitals).
// Placement defaults to the bottom row; `at` moves it ({ x, y, w }).
function badge(field, label, x, fill, cond, { minSize = 3.5, at = {}, ...valueStyle } = {}) {
  const c = { ...cond, when: field };
  const y = at.y ?? ROW_Y;
  const w = at.w ?? 18;
  return [
    { ...c, type: 'rect', x, y, w, h: ROW_H, fill, stroke: '#d8cfb8', strokeWidth: 0.45, radius: 1.6, bevel: true },
    { ...c, type: 'text', text: label, x, y: y + 0.5, w, h: 2.6, font: 'label', size: 2.6, color: '#d8cfb8', align: 'center', valign: 'middle', baseline: 0.36 },
    { ...c, type: 'text', field, x: x + 1, y: y + 2.8, w: w - 2, h: 5.4, font: 'title', size: 6, minSize, lineHeight: 0.95, color: '#ffffff', align: 'center', valign: 'middle', shadow: true, ...valueStyle },
  ];
}

// ACTION stat row under the art: Range, To Hit, [W] (the weapon damage die) and
// Usage as four see-through badges, each only when the action has it.
const ACTION_ROW_Y = 53.6;
const ACTION_BADGE_W = (90 - 3 * 1.2) / 4;
const actionBadge = (i, field, label, fill, extra = {}) =>
  badge(field, label, 5 + i * (ACTION_BADGE_W + 1.2), fill, ACTION_ONLY, { minSize: 2.4, at: { y: ACTION_ROW_Y, w: ACTION_BADGE_W }, ...extra });

// A bar in the stack above the text box: a labelled stat on a paper strip
// ("IMMUNITIES Poison, Bleeding"; "DAMAGE 3d6 + 4d10 + 12 Shadow/Cold"). Taller bars
// fit two lines for the wordy ones (Damage, Crit); the text shrinks to fit.
function bar(field, label, h, extra = {}) {
  return {
    when: field,
    h,
    elements: [
      { ...PANEL },
      {
        type: 'text', field, label, labelColor: LABEL, labelSep: '', inset: [3, 0.2],
        font: 'body', weight: 'bold', size: 3.8, minSize: 2.2, lineHeight: 1.02, color: TEXT, valign: 'middle', ...extra,
      },
    ],
  };
}

// The text box: whatever space the bars leave between the art and the type line.
const TEXT_FILL = {
  fill: true,
  elements: [
    { ...PANEL },
    {
      type: 'text', parts: ['text', { field: 'flavor', italic: true, color: '#5e5140' }], inset: [3, 1.4],
      font: 'body', size: 4.6, minSize: 2.4, lineHeight: 1.18, color: TEXT, valign: 'top',
    },
  ],
};
const MIDDLE_AREA = { type: 'stack', x: 5, y: 53.6, w: 90, h: 26, gap: 0.5 };
// Actions: below the stat row, down to the type line at the bottom of the card.
const ACTION_AREA = { type: 'stack', x: 5, y: ACTION_ROW_Y + ROW_H + 0.8, w: 90, h: 89.6 - (ACTION_ROW_Y + ROW_H + 0.8), gap: 0.5 };
const TYPE_Y = { ally: 80.6, action: 90.6 };
const typeLine = (y, cond) => [
  { ...cond, type: 'rect', x: 5, y, w: 90, h: 6, fill: GLASS_DARK, radius: 1 },
  {
    ...cond, type: 'text', join: ['type', { field: 'tags', list: true }], sep: ' — ',
    x: 7.5, y, w: 85, h: 6, font: 'label', size: 4.2, minSize: 2.6, color: NAME, valign: 'middle', baseline: 0.36, shadow: true,
  },
];

export default {
  id: 'allies',
  name: 'Allies',
  description: 'Allies (draft): characters and their actions, with backgrounds blended from their Aura. Inverted auras blight their share of the color.',
  defaultColor: '#6b5a45',
  matchColumns: [['aura', 'armor', 'health'], ['aura', 'usage']],
  fonts: {
    title: { font: 'cinzel', weight: 700 },
    body: { font: 'crimson', weight: 400, boldWeight: 700 },
    label: { font: 'bebas', weight: 400, boldWeight: 400 },
  },
  hover: [
    { field: 'type', bold: true },
    labelled('tags', 'Tags'),
    labelled('aura', 'Aura'),
    labelled('armor', 'Armor'),
    labelled('health', 'Health'),
    labelled('resists', 'Resists'),
    labelled('immunities', 'Immune'),
    labelled('to_hit', 'To Hit'),
    labelled('damage', 'Damage'),
    labelled('crit', 'Crit'),
    labelled('skill_check', 'Skill Check'),
    labelled('w', '[W]'),
    labelled('range', 'Range'),
    labelled('usage', 'Usage'),
    'text',
    { field: 'flavor', italic: true },
  ],
  elements: [
    // The aura background, then a thin dark line just inside the edge.
    {
      type: 'blend', field: 'aura', colors: AURA, modifiers: MODIFIERS, styleField: 'blend',
      fallback: ['#55595e', '#8d9298', '#5f6368', '#4c5055'], x: 0, y: 0, w: 100, h: 100, texture: 'grit', textureStrength: 0.35,
    },
    { type: 'rect', x: 2.2, y: 1.6, w: 95.6, h: 96.8, stroke: 'rgba(15, 12, 9, 0.55)', strokeWidth: 0.5, radius: 2.6 },

    // Name bar
    { type: 'rect', x: 5, y: 3.4, w: 90, h: 8.2, fill: GLASS_DARK, stroke: 'rgba(255, 255, 255, 0.18)', strokeWidth: 0.3, radius: 1.2 },
    { type: 'text', field: 'name', x: 7.5, y: 3.4, w: 85, h: 8.2, font: 'title', size: 6.2, minSize: 3.5, color: NAME, valign: 'middle', shadow: true },

    // Art
    { type: 'image', x: 5, y: 12.6, w: 90, h: 40, radius: 1, stroke: INK, strokeWidth: 0.6 },

    // Between the art and the type line: stat bars, then the text box in the space left.
    // ALLY: Immunities, then Resistances.
    { ...MIDDLE_AREA, ...ALLY_ONLY, items: [bar('immunities', 'IMMUNITIES', 4.6), bar('resists', 'RESISTANCES', 4.6), TEXT_FILL] },
    // ACTION: the stat row, then a Skill Check bar (non-attacks) or Damage and Crit bars
    // (attacks; two smaller lines when long), then the text box down to the type line.
    ...actionBadge(0, 'range', 'RANGE', 'rgba(44, 70, 86, 0.78)'),
    ...actionBadge(1, 'to_hit', 'TO HIT', 'rgba(90, 38, 36, 0.78)'),
    ...actionBadge(2, 'w', '[W]', 'rgba(61, 47, 79, 0.78)', { font: 'body', weight: 'bold', size: 6.4 }),
    ...actionBadge(3, 'usage', 'USAGE', 'rgba(91, 69, 36, 0.78)'),
    { ...ACTION_AREA, ...ACTION_ONLY, items: [bar('skill_check', 'SKILL CHECK', 5), bar('damage', 'DAMAGE', 5), bar('crit', 'CRIT', 5.6, { weight: undefined }), TEXT_FILL] },

    // Type line ("Ally — Beast · Guardian"): above the bottom row on allies, at the
    // very bottom on actions.
    ...typeLine(TYPE_Y.ally, ALLY_ONLY),
    ...typeLine(TYPE_Y.action, ACTION_ONLY),

    // Bottom row (allies only): Armor, the Aura as colored boxes, Health. Actions
    // don't show their Aura boxes; it only colors the background.
    ...badge('armor', 'ARMOR', LEFT, '#3a3d46', ALLY_ONLY),
    {
      ...ALLY_ONLY, type: 'text', field: 'aura', list: true, listSep: ' ', bold: true, chip: { fill: '#ddd', stroke: '#0003' }, itemChips: AURA_CHIPS,
      x: 24.5, y: ROW_Y, w: 51, h: ROW_H, font: 'body', size: 4.6, minSize: 2.4, lineHeight: 1.4, align: 'center', valign: 'middle',
    },
    ...badge('health', 'HEALTH', RIGHT, '#7a2320', ALLY_ONLY),
  ],
};
