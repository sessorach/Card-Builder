// Allies (working name): characters and, later, the actions they take, in one
// layout with a variant per card type. Draft: the Ally card.
//
// The background is the card's Aura: each aura word is a color, its number is its
// share of the card ("Instinct 2, Knowledge 1" is two-thirds green), and an aura
// marked Inverted turns its share a sickly black. A `blend` column picks the style
// per card: gradient (default), split, tie-dye, marble or solid.
//
// Columns: name, type (Ally), tags, aura, armor, health, resists, immunities,
// text (abilities), flavor, blend, art (optional; images match by card name).

// Aura colors. Keys are the words looked for in the aura cell (any capitalization).
const AURA = {
  instinct: '#2f8f55',
  knowledge: '#2c69b8',
  passion: '#c23b2c',
  discipline: '#ece4cf',
};
// "Inverted Passion" or "Passion (Inverted)": that part mixed toward a sickly black.
const SICKLY = '#161d0c';
const MODIFIERS = { inverted: { mix: SICKLY, amount: 0.82 } };

const INK = '#17130f';
const NAME = '#f1e6cc';
const PAPER = '#efe6d0';
const TEXT = '#2b241c';
const LABEL = '#7a5a2a';

// Aura chips in the text box, colored like the background they make.
const AURA_CHIPS = {
  inverted: { fill: SICKLY, stroke: '#56632f', color: '#b9c98a' },
  instinct: { fill: AURA.instinct, stroke: '#1d5c37', color: '#ffffff' },
  knowledge: { fill: AURA.knowledge, stroke: '#1c4478', color: '#ffffff' },
  passion: { fill: AURA.passion, stroke: '#7d2219', color: '#ffffff' },
  discipline: { fill: AURA.discipline, stroke: '#8a7f66', color: '#3a3226' },
};

const labelled = (field, label) => ({ field, label, labelColor: LABEL });

// A stat badge at the bottom corners, like a power/toughness box.
function badge(field, label, x, fill) {
  return [
    { when: field, type: 'rect', x, y: 88.2, w: 20, h: 8.4, fill, stroke: '#d8cfb8', strokeWidth: 0.45, radius: 1.6, bevel: true },
    { when: field, type: 'text', text: label, x, y: 88.7, w: 20, h: 2.6, font: 'label', size: 2.6, color: '#d8cfb8', align: 'center', valign: 'middle', baseline: 0.36 },
    { when: field, type: 'text', field, x, y: 90.9, w: 20, h: 5.4, font: 'title', size: 6, minSize: 3.5, lineHeight: 0.9, color: '#ffffff', align: 'center', valign: 'middle', shadow: true },
  ];
}

export default {
  id: 'allies',
  name: 'Allies',
  description: 'Allies (draft): characters whose background is blended from their Aura. Inverted auras turn their share a sickly black.',
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
    { type: 'rect', x: 5, y: 3.4, w: 90, h: 8.2, fill: INK, stroke: 'rgba(255, 255, 255, 0.18)', strokeWidth: 0.3, radius: 1.2, bevel: true },
    { type: 'text', field: 'name', x: 7.5, y: 3.4, w: 85, h: 8.2, font: 'title', size: 6.2, minSize: 3.5, color: NAME, valign: 'middle' },

    // Art
    { type: 'image', x: 5, y: 12.6, w: 90, h: 40, radius: 1, stroke: INK, strokeWidth: 0.6 },

    // Type line: "Ally — Beast · Guardian"
    { type: 'rect', x: 5, y: 53.6, w: 90, h: 6, fill: INK, radius: 1 },
    {
      type: 'text', join: ['type', { field: 'tags', list: true }], sep: ' — ',
      x: 7.5, y: 53.6, w: 85, h: 6, font: 'label', size: 4.2, minSize: 2.6, color: NAME, valign: 'middle', baseline: 0.36,
    },

    // Text box: aura chips, resists and immunities, abilities, flavor.
    { type: 'rect', x: 5, y: 60.6, w: 90, h: 28.6, fill: PAPER, texture: 'paper', textureStrength: 0.8, radius: 1.2 },
    {
      type: 'text',
      parts: [
        { field: 'aura', list: true, listSep: ' ', bold: true, chip: { fill: '#ddd', stroke: '#0003' }, itemChips: AURA_CHIPS },
        { join: [labelled('resists', 'Resists'), labelled('immunities', 'Immune')], sep: '   ' },
        'text',
        { field: 'flavor', italic: true, color: '#6a5d4a' },
      ],
      x: 8, y: 62.2, w: 84, h: 25.2, font: 'body', size: 4.6, minSize: 2.4, lineHeight: 1.18, color: TEXT, valign: 'top',
    },

    // Armor and Health
    ...badge('armor', 'ARMOR', 5, '#3a3d46'),
    ...badge('health', 'HEALTH', 75, '#7a2320'),
  ],
};
