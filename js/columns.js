// What each spreadsheet column does, for the Template & guide tab. The tab lists the
// columns of the chosen layout (from js/template.js) with these descriptions, so
// each look explains only its own columns. A layout can word a shared column its
// own way: { all: '…', street: '…' }. Pure; Node-tested (every template column of
// every layout needs a description here).

const BONUS = 'An item bonus, shown as a badge (e.g. 2 shows +2). Leave it empty or 0 to hide it.';
const WEAPON = "Part of an item's weapon line.";
const FROM_SHEET = 'Filled in by the FlagonQuest Character Sheet when you use Make cards there. Leave it empty in your own spreadsheet.';

export const COLUMN_HELP = {
  name: 'The card\'s name, at the top. The only column every card needs.',
  count: 'How many copies go in the Tabletop Simulator deck. Empty means 1; 0 leaves the card out.',
  deck: 'Which deck the card goes in. Each deck becomes its own Tabletop Simulator object.',
  cost: {
    all: 'Shown in a badge in the corner.',
    street: 'Shown in the top corner with a $ in front: 3 shows $3.',
    flagonquest: 'A technique\'s cost line, e.g. Discard a card.',
  },
  type: {
    all: 'The type line, e.g. Creature.',
    street: 'Shown in the type bar near the bottom.',
    rossquest: 'Ally or Action. Allies get Armor, Health and the Aura boxes; actions get the stat badges and bars. In a spreadsheet, anything but Action makes an ally.',
  },
  subtype: 'Shown after the type: Creature and Imp make “Creature — Imp”.',
  tags: {
    all: 'Tags, all in one cell separated by commas.',
    street: 'Tags, all in one cell separated by commas, shown after the type.',
    flagonquest: 'Tags, separated by commas, e.g. Martial, Buildable, Encounter. Encounter gets its own badge; the rest are chips.',
    rossquest: 'Shown after the type, separated by commas: Beast, Guardian shows “Ally — Beast · Guardian”.',
  },
  text: {
    all: 'What the card does. You can write **bold**, *italic*, {icon} and line breaks.',
    flagonquest: 'The Effects text. Your spreadsheet\'s Effects column works too.',
  },
  flavor: {
    all: 'Optional story text, in italics under the rules.',
    flagonquest: 'Not printed on the card (as on the Character Sheet); it shows when you hover over the card in Tabletop Simulator.',
  },
  stats: 'One badge in the corner, e.g. 3 / 2.',
  color: {
    all: 'Optional card color: a name (crimson) or a hex code (#3b5b7a).',
    rossquest: 'Optional. One background color in place of the Aura blend: a name (crimson) or a hex code (#3b5b7a). The Aura boxes still show.',
  },

  // Street
  strengf: 'A stat in its own box. Cards without stats get a taller rules box.',
  helf: 'A stat in its own box.',
  steal: 'A stat in its own box.',
  equip_cost: 'An equip cost in one box, shown with a $.',

  // FlagonQuest
  level_min: 'The lowest level of a technique, shown in its level badge (Lv 1–4).',
  level_max: 'The highest level of a technique. Leave it the same as level_min for a single level.',
  category: 'Marks the row as an item (Weapon, Armor, Masterwork…). Rows without a category are techniques.',
  slot: 'The item\'s slot, next to its category.',
  level: 'The item\'s level, shown on Masterwork and Material items.',
  condition: 'A technique\'s Condition line.',
  action: 'A technique\'s Action line, e.g. 2 AP.',
  target: 'A technique\'s Target line.',
  special: 'A technique\'s Special line.',
  choice_effects: 'For techniques with a choice: one line per option, "Option: effect".',
  built_features: FROM_SHEET,
  picks: FROM_SHEET,
  powers: FROM_SHEET,
  accuracy: WEAPON,
  damage: {
    all: WEAPON,
    rossquest: 'A bar for the damage. Long ones are fine, e.g. 3d6 + 4d10 + 12 Shadow/Slash/Cold.',
  },
  range: {
    all: WEAPON,
    rossquest: 'The first badge under the picture, e.g. 8 or Melee.',
  },
  relevant_skills: WEAPON,
  weapon_defense: `${WEAPON} Shown as Parry.`,
  might_requirement: `${WEAPON} Shown as Might Req.`,
  physical_resist: BONUS,
  fire_resist: BONUS,
  frost_resist: BONUS,
  brilliant_resist: BONUS,
  shadow_resist: BONUS,
  speed: BONUS,
  parry_defense: BONUS,
  dodge_defense: BONUS,
  vital_defense: BONUS,
  mental_defense: BONUS,
  vigilant_defense: BONUS,
  shallow_health: BONUS,
  deep_health: BONUS,
  material_types: 'A material\'s types, shown as badges, separated by commas.',

  // RossQuest
  aura: 'The card\'s colors: Instinct, Knowledge, Passion and/or Discipline, separated by commas, with optional numbers and Inverted. See The Aura below.',
  blend: 'Optional. How the colors are mixed: gradient (the default), split, tie-dye, marble or solid.',
  armor: 'Allies: a number in the bottom-right corner, next to Health.',
  health: 'Allies: a number in the last badge, bottom right.',
  immunities: 'Allies: a strip under the picture, e.g. Poison, Bleeding.',
  resists: 'Allies: a strip under Immunities, shown as Resistances.',
  to_hit: 'Actions: the second badge, e.g. +5.',
  w: 'Actions: the third badge, the weapon damage die, e.g. d8 or 1d4+2. The column can be called [W].',
  usage: 'Actions: the fourth badge, e.g. 1/turn or Once per battle.',
  skill_check: 'Actions that aren\'t attacks: a bar under the badges, e.g. Acrobatics 10 + 1d6.',
  crit: 'Actions: a bar for what a critical hit does. Can be a whole sentence.',
};

// The description of a column for one layout, or '' when there is none.
export function columnHelp(column, layoutId) {
  const help = COLUMN_HELP[column];
  if (!help) return '';
  if (typeof help === 'string') return help;
  return help[layoutId] ?? help.all ?? '';
}
