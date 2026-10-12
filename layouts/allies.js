// Allies (working name): characters and, later, the actions they take, in one
// layout with a variant per card type. Draft: the Ally card.
//
// The background is the card's Aura: each aura word is a color, its number is its
// share of the card ("Instinct 2, Knowledge 1" is two-thirds green), and an aura
// marked Inverted blights its share: a darker, sickly, veined version of that
// color. A `blend` column picks the style per card: gradient (default), split,
// tie-dye, marble or solid.
//
// Columns: name, type (Ally), tags, aura, armor, health, resists, immunities,
// text (abilities), flavor, blend, art (optional; images match by card name).

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
const PAPER = '#efe6d0';
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

// The bottom row: Armor (left) and Health (right) badges, like a power/toughness box.
const ROW_Y = 87.8;
const ROW_H = 8.6;
function badge(field, label, x, fill) {
  return [
    { when: field, type: 'rect', x, y: ROW_Y, w: 18, h: ROW_H, fill, stroke: '#d8cfb8', strokeWidth: 0.45, radius: 1.6, bevel: true },
    { when: field, type: 'text', text: label, x, y: ROW_Y + 0.5, w: 18, h: 2.6, font: 'label', size: 2.6, color: '#d8cfb8', align: 'center', valign: 'middle', baseline: 0.36 },
    { when: field, type: 'text', field, x, y: ROW_Y + 2.8, w: 18, h: 5.4, font: 'title', size: 6, minSize: 3.5, lineHeight: 0.9, color: '#ffffff', align: 'center', valign: 'middle', shadow: true },
  ];
}

// A small labelled box for a list stat (Resistances, Immunities) above the text box.
function statBox(field, label, x) {
  return [
    { when: field, type: 'rect', x, y: 53.6, w: 44, h: 8.4, fill: GLASS_PAPER, texture: 'paper', textureStrength: 0.6, radius: 1.2 },
    { when: field, type: 'text', text: label, x: x + 2.5, y: 54.2, w: 39, h: 2.8, font: 'label', size: 2.8, color: LABEL, valign: 'middle', baseline: 0.36 },
    { when: field, type: 'text', field, x: x + 2.5, y: 56.9, w: 39, h: 4.6, font: 'body', weight: 'bold', size: 3.8, minSize: 2.2, lineHeight: 1.05, color: TEXT, valign: 'middle' },
  ];
}

// See-through panels, so the aura shows behind the name, type line and text.
const GLASS_DARK = 'rgba(23, 19, 15, 0.7)';
const GLASS_PAPER = 'rgba(239, 230, 208, 0.82)';

// The ability text box: full height, or shorter under the stat boxes.
const TEXT_RECT = { type: 'rect', x: 5, y: 53.6, w: 90, h: 26, fill: GLASS_PAPER, texture: 'paper', textureStrength: 0.6, radius: 1.2 };
const TEXT_BOX = {
  type: 'text', parts: ['text', { field: 'flavor', italic: true, color: '#5e5140' }],
  x: 8, y: 55.2, w: 84, h: 22.8, font: 'body', size: 4.6, minSize: 2.4, lineHeight: 1.18, color: TEXT, valign: 'top',
};

export default {
  id: 'allies',
  name: 'Allies',
  description: 'Allies (draft): characters whose background is blended from their Aura. Inverted auras blight their share of the color.',
  defaultColor: '#6b5a45',
  matchColumns: ['aura', 'armor', 'health'],
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
    'text',
    { field: 'flavor', italic: true },
  ],
  elements: [
    // The aura background, then a thin dark line just inside the edge.
    {
      type: 'blend', field: 'aura', colors: AURA, modifiers: MODIFIERS, styleField: 'blend',
      fallback: '#6f6a62', x: 0, y: 0, w: 100, h: 100, texture: 'grit', textureStrength: 0.35,
    },
    { type: 'rect', x: 2.2, y: 1.6, w: 95.6, h: 96.8, stroke: 'rgba(15, 12, 9, 0.55)', strokeWidth: 0.5, radius: 2.6 },

    // Name bar
    { type: 'rect', x: 5, y: 3.4, w: 90, h: 8.2, fill: GLASS_DARK, stroke: 'rgba(255, 255, 255, 0.18)', strokeWidth: 0.3, radius: 1.2 },
    { type: 'text', field: 'name', x: 7.5, y: 3.4, w: 85, h: 8.2, font: 'title', size: 6.2, minSize: 3.5, color: NAME, valign: 'middle', shadow: true },

    // Art
    { type: 'image', x: 5, y: 12.6, w: 90, h: 40, radius: 1, stroke: INK, strokeWidth: 0.6 },

    // Resistances and Immunities, each in its own small box when the card has it,
    // then the ability text in the rest of the space (all of it when there are none).
    ...statBox('resists', 'RESISTANCES', 5),
    ...statBox('immunities', 'IMMUNITIES', 51),
    { when: ['resists', 'immunities'], ...TEXT_RECT, y: 63, h: 16.6 },
    { when: ['resists', 'immunities'], ...TEXT_BOX, y: 64.4, h: 13.8 },
    { unless: ['resists', 'immunities'], ...TEXT_RECT },
    { unless: ['resists', 'immunities'], ...TEXT_BOX },

    // Type line: "Ally — Beast · Guardian"
    { type: 'rect', x: 5, y: 80.6, w: 90, h: 6, fill: GLASS_DARK, radius: 1 },
    {
      type: 'text', join: ['type', { field: 'tags', list: true }], sep: ' — ',
      x: 7.5, y: 80.6, w: 85, h: 6, font: 'label', size: 4.2, minSize: 2.6, color: NAME, valign: 'middle', baseline: 0.36, shadow: true,
    },

    // Bottom row: Armor, the Aura as colored boxes, Health.
    ...badge('armor', 'ARMOR', 5, '#3a3d46'),
    {
      type: 'text', field: 'aura', list: true, listSep: ' ', bold: true, chip: { fill: '#ddd', stroke: '#0003' }, itemChips: AURA_CHIPS,
      x: 24.5, y: ROW_Y, w: 51, h: ROW_H, font: 'body', size: 4.6, minSize: 2.4, lineHeight: 1.4, align: 'center', valign: 'middle',
    },
    ...badge('health', 'HEALTH', 77, '#7a2320'),
  ],
};
