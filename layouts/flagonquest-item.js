// FlagonQuest Item: a reference card for a FlagonQuest item, the companion to
// the technique card, styled like the item tiles on the FlagonQuest site. It
// reads FlagonQuest's own items spreadsheet as-is: drop in scripts/items.csv.
//
// Columns used: name, level, category, slot, tags, cost, the weapon profile
// (accuracy, damage, range, relevant_skills, weapon_defense, might_requirement,
// held_slots), the flat bonuses (resists, defenses, speed, health), text (the
// sheet's "Effects"), value_per_level (materials), flavor (the sheet's
// "Description (Fluff)") and main_materials.
import { BODY, LABEL, MUTED, GOLD, FONTS, labelled, frameAndName, divider, footer } from './flagonquest-common.js';

// Shown like the site's inline weapon line: "Accuracy +1 · Damage 3 + [Body] · …".
const stat = (field, label, extra = {}) => ({ field, label, labelColor: LABEL, labelSep: '', ...extra });
const WEAPON = [
  stat('accuracy', 'Accuracy', { signed: true }),
  stat('damage', 'Damage'),
  stat('range', 'Range'),
  stat('relevant_skills', 'Skill'),
  stat('weapon_defense', 'Parry', { signed: true }),
  stat('might_requirement', 'Might Req'),
  stat('held_slots', 'Hands'),
];

// Flat bonuses, in gold like the site's stat badges; zeros are left out like on the site.
const bonus = (field, label) => ({ field, label, labelSep: '', signed: true, hideZero: true, bold: true, color: GOLD, labelColor: GOLD });
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

const hoverStat = ({ field, label }) => labelled(field, label);

export default {
  id: 'flagonquest-item',
  name: 'FlagonQuest Item',
  description: 'FlagonQuest item reference card. Drop in the items spreadsheet from the FlagonQuest repo as-is.',
  defaultColor: GOLD,
  matchColumns: ['category', 'slot', 'damage'],
  fonts: FONTS,
  hover: [
    labelled('category', 'Category'),
    labelled('slot', 'Slot'),
    labelled('tags', 'Tags'),
    labelled('level', 'Level'),
    labelled('cost', 'Cost'),
    ...WEAPON.map(hoverStat),
    ...BONUSES.map(hoverStat),
    'text',
    labelled('value_per_level', 'Value per Level'),
    labelled('main_materials', 'Materials'),
    { field: 'flavor', italic: true },
  ],
  elements: [
    ...frameAndName({ when: 'level', field: 'level', prefix: 'Lv ' }),

    // "Category · Slot · Tags" on the left, the cost in gold on the right.
    {
      type: 'text', join: ['category', 'slot', { field: 'tags', list: true }], sep: ' · ',
      x: 6, y: 12.2, w: 58, h: 5.4, font: 'body', weight: 'bold', size: 3.9, minSize: 2.6, color: MUTED, valign: 'middle',
    },
    {
      when: 'cost', type: 'text', field: 'cost',
      x: 64, y: 12.2, w: 30, h: 5.4, font: 'body', weight: 'bold', size: 4.2, minSize: 2.6, color: GOLD, align: 'right', valign: 'middle',
    },
    divider,

    // Weapon line, bonuses, effects, then the flavor text in italics.
    {
      type: 'text',
      parts: [
        { join: WEAPON, sep: ' · ' },
        { join: BONUSES, sep: ' · ' },
        'text',
        labelled('value_per_level', 'Value per Level'),
        { field: 'flavor', italic: true, color: MUTED },
      ],
      x: 6, y: 20.8, w: 88, h: 66.4, font: 'body', size: 5, minSize: 2.4, lineHeight: 1.22, color: BODY, valign: 'top',
    },

    ...footer(labelled('main_materials', 'Materials')),
  ],
};
