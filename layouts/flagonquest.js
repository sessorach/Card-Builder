// FlagonQuest: one reference card for FlagonQuest techniques and items, showing
// what the FlagonQuest site's Character Sheet shows, inside a card frame. It reads
// FlagonQuest's own spreadsheets as-is: drop in scripts/techniques.csv or
// scripts/items.csv from the flagonquest repo. A row with a Category is an item;
// any other row is a technique.
//
// KEEPING IN SYNC WITH THE SITE (flagonquest repo, index.html):
//   Colors          TEXT, cardBoxStyle, statBadgeStyle, and the badge colors written
//                   inline in TechCard / InventoryTile  →  the constants below
//   Technique card  TechCard with readOnly (the Character Sheet)  →  TECHNIQUE
//   Item card       InventoryTile with readOnly  →  ITEM
//   Item bonuses    ITEM_STAT_FIELDS  →  BONUSES
//   Weapon line     WEAPON_INFO_FIELDS (+ Parry)  →  WEAPON
// Things the sheet hides (flavor text, prereqs, item cost, materials) go in the
// TTS hover text instead (`hover` below).

// ---- The site's palette -----------------------------------------------------------
const PAGE = '#0a0e18'; // around the card
const CARD = '#161b27'; // cardBoxStyle background
const LINE = '#2d3555'; // cardBoxStyle border, chip borders
const PANEL = '#0d1117'; // tag and category chips
const NAME = '#e8dfc8'; // TEXT.name
const BODY = '#d3c9a3'; // TEXT.body
const LABEL = '#a68f52'; // TEXT.label
const MUTED = '#9c9576'; // TEXT.muted
const FAINT = '#726c58'; // TEXT.faint
const GOLD = '#d4a843'; // the card frame (Card Builder's own, not on the site)
const LEVEL_CHIP = { fill: '#24221a', stroke: '#5b5540' }; // level badges
const ENCOUNTER = { fill: '#2a1a00', stroke: '#a0672e', color: '#e6943a' };
const TAG_CHIP = { fill: PANEL, stroke: LINE };
const TAG_COLORS = { Buildable: '#7F77DD', Duplicate: '#1D9E75' };
const STAT_BADGE = { fill: '#20180a', stroke: '#6b5423', color: '#e8c46a' }; // statBadgeStyle

const ITEM = 'category'; // the column that marks a row as an item

// "Label: value" with the label in the site's gold, only when there's a value.
const labelled = (field, label, extra = {}) => ({ field, label, labelColor: LABEL, ...extra });

// ---- Item pieces --------------------------------------------------------------------
// The weapon line, all in faint text: "Accuracy +1  ·  Damage 3 + [Body]  ·  … · Might Req 4".
const weapon = (field, label, extra = {}) => ({ field, label, labelSep: '', labelBold: false, ...extra });
const WEAPON = [
  weapon('accuracy', 'Accuracy', { signed: true }),
  weapon('damage', 'Damage'),
  weapon('range', 'Range'),
  weapon('relevant_skills', 'Skill'),
  weapon('weapon_defense', 'Parry', { signed: true }),
  weapon('might_requirement', 'Might Req'),
];

// Flat bonuses as amber badges ("Physical Resist +2"); zeros are left out, as on the site.
const bonus = (field, label) => ({
  field, label, labelSep: '', signed: true, hideZero: true, bold: true, color: STAT_BADGE.color, labelColor: STAT_BADGE.color, chip: STAT_BADGE,
});
const BONUSES = [
  bonus('physical_resist', 'Physical Resist'),
  bonus('fire_resist', 'Fire Resist'),
  bonus('frost_resist', 'Frost Resist'),
  bonus('brilliant_resist', 'Brilliant Resist'),
  bonus('shadow_resist', 'Shadow Resist'),
  bonus('speed', 'Speed'),
  bonus('parry_defense', 'Parry Defense'),
  bonus('dodge_defense', 'Dodge Defense'),
  bonus('vital_defense', 'Vital Defense'),
  bonus('mental_defense', 'Mental Defense'),
  bonus('vigilant_defense', 'Vigilant Defense'),
  bonus('shallow_health', 'Shallow Health'),
  bonus('deep_health', 'Deep Health'),
];

// The site shows a level badge only on Masterwork and Material items.
const LEVELLED = { field: ITEM, value: ['Masterwork', 'Material'] };
const CATEGORY_CHIP = { join: [ITEM, 'slot'], sep: ' · ', chip: TAG_CHIP, color: MUTED };

const hoverOf = ({ field, label }) => ({ field, label, hideZero: true });

// ---- Layout --------------------------------------------------------------------------
const NAME_TEXT = { type: 'text', field: 'name', x: 6, y: 3.6, h: 8.4, font: 'title', size: 7.2, minSize: 4, color: NAME, valign: 'middle' };
const BADGE = { y: 4.4, w: 21, h: 6.6, radius: 1, strokeWidth: 0.3 };
const BADGE_TEXT = { type: 'text', y: 4.4, w: 21, h: 6.6, font: 'body', size: 4.8, minSize: 3, align: 'center', valign: 'middle' };
const ROW_2 = { type: 'text', x: 6, y: 12.2, w: 88, h: 5.4, font: 'body', size: 3.6, minSize: 2.4, valign: 'middle' };
const BODY_TEXT = { type: 'text', x: 6, y: 20.8, w: 88, h: 74.6, font: 'body', size: 5, minSize: 2.4, lineHeight: 1.22, color: BODY, valign: 'top' };
const ENCOUNTER_TAG = { field: 'tags', value: 'Encounter' };

export default {
  id: 'flagonquest',
  name: 'FlagonQuest',
  description: 'FlagonQuest technique and item cards, like the Character Sheet. Drop in the techniques or items spreadsheet from the FlagonQuest repo as-is.',
  // The two layouts this one replaced; spreadsheets naming them still work.
  aliases: ['flagonquest-technique', 'flagonquest-item'],
  defaultColor: GOLD,
  // Picked automatically for a spreadsheet with either set of columns (and no layout column).
  matchColumns: [['level_min', 'action', 'prereqs'], [ITEM, 'slot', 'damage']],
  fonts: {
    title: { font: 'medievalsharp', weight: 400, boldWeight: 400 },
    body: { font: 'barlow', weight: 500, boldWeight: 700 },
  },
  // What TTS shows when you hover over the card: everything on it, plus what the sheet hides.
  hover: [
    labelled(ITEM, 'Category'),
    labelled('slot', 'Slot'),
    labelled('tags', 'Tags'),
    labelled('level', 'Level'),
    labelled('condition', 'Condition'),
    labelled('action', 'Action'),
    labelled('cost', 'Cost'),
    labelled('target', 'Target'),
    // Techniques have Relevant Skills too, so the hover says "Skills" rather than the weapon line's "Skill".
    ...WEAPON.map((w) => hoverOf(w.field === 'relevant_skills' ? { ...w, label: 'Skills' } : w)),
    { field: 'held_slots', label: 'Hands' },
    ...BONUSES.map(hoverOf),
    'text',
    'choice_effects',
    labelled('special', 'Special'),
    labelled('value_per_level', 'Value per Level'),
    labelled('main_materials', 'Materials'),
    labelled('material_types', 'Material Types'),
    labelled('prereqs', 'Prereqs'),
    { field: 'flavor', italic: true },
  ],
  elements: [
    // The card frame.
    { type: 'rect', x: 0, y: 0, w: 100, h: 100, fill: PAGE },
    { type: 'rect', x: 2.5, y: 1.8, w: 95, h: 96.4, fill: CARD, texture: 'grit', textureStrength: 0.3, stroke: 'accent', strokeWidth: 0.5, radius: 2.5 },

    // ---- TECHNIQUE: name, then [Encounter] [Lv 1–4] in the corner ----
    { ...NAME_TEXT, unless: ITEM, unlessHas: ENCOUNTER_TAG, w: 65 },
    { ...NAME_TEXT, unless: ITEM, whenHas: ENCOUNTER_TAG, w: 42 },
    { unless: ITEM, whenHas: ENCOUNTER_TAG, type: 'rect', ...BADGE, x: 50, w: 21.5, fill: ENCOUNTER.fill, stroke: ENCOUNTER.stroke },
    { unless: ITEM, whenHas: ENCOUNTER_TAG, ...BADGE_TEXT, x: 50, w: 21.5, text: 'Encounter', color: ENCOUNTER.color },
    { unless: ITEM, type: 'rect', ...BADGE, x: 73, fill: LEVEL_CHIP.fill, stroke: LEVEL_CHIP.stroke },
    { unless: ITEM, when: 'level_min', ...BADGE_TEXT, x: 73, color: NAME, join: [{ field: 'level_min', prefix: 'Lv ' }, 'level_max'], sep: '–', unique: true },
    { unless: [ITEM, 'level_min'], ...BADGE_TEXT, x: 73, color: NAME, text: 'Draft' },
    // The other tags as chips; Buildable in purple, Duplicate in green.
    { ...ROW_2, unless: ITEM, field: 'tags', list: true, exclude: ['Encounter'], chip: TAG_CHIP, itemColors: TAG_COLORS, weight: 'bold', color: MUTED },

    // ---- ITEM: name, then a "Category · Slot" chip and (Masterwork/Material) a level chip ----
    { ...NAME_TEXT, when: ITEM, w: 88 },
    { ...ROW_2, when: ITEM, unlessHas: LEVELLED, join: [CATEGORY_CHIP] },
    { ...ROW_2, when: ITEM, whenHas: LEVELLED, join: [CATEGORY_CHIP, { field: 'level', prefix: 'Lv ', chip: LEVEL_CHIP, color: NAME }], sep: ' ' },

    { type: 'rect', x: 6, y: 18.8, w: 88, h: 0.25, fill: 'accent', opacity: 0.55 },

    // ---- TECHNIQUE body: Condition, Action, Cost, Target, Effects, choice effects, Special ----
    {
      ...BODY_TEXT,
      unless: ITEM,
      parts: [
        labelled('condition', 'Condition'),
        labelled('action', 'Action'),
        labelled('cost', 'Cost'),
        labelled('target', 'Target'),
        'text',
        'choice_effects',
        labelled('special', 'Special'),
      ],
    },

    // ---- ITEM body: Effects, the weapon line, bonus badges, material type badges ----
    {
      ...BODY_TEXT,
      when: ITEM,
      parts: [
        'text',
        { join: WEAPON, sep: '  ·  ', color: FAINT },
        { join: BONUSES, sep: ' ' },
        { field: 'material_types', list: true, chip: STAT_BADGE, bold: true, color: STAT_BADGE.color },
      ],
    },
  ],
};
