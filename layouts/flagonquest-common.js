// Shared look for the FlagonQuest layouts (not a layout itself): the FlagonQuest
// site's palette and fonts, plus the card frame and header both card types use.

export const PAGE = '#0a0e18';
export const CARD = '#161b27';
export const PANEL = '#0d1117';
export const LINE = '#2d3555';
export const NAME = '#e8dfc8';
export const BODY = '#d3c9a3';
export const LABEL = '#a68f52';
export const MUTED = '#9c9576';
export const GOLD = '#d4a843';

export const FONTS = {
  title: { font: 'medievalsharp', weight: 400, boldWeight: 400 },
  body: { font: 'barlow', weight: 500, boldWeight: 700 },
};

// "Label: value" in the site's gold label color, shown only when there's a value.
export const labelled = (field, label, extra = {}) => ({ field, label, labelColor: LABEL, ...extra });

// Background, frame, name, and the level badge in the top right.
export function frameAndName(levelText) {
  return [
    { type: 'rect', x: 0, y: 0, w: 100, h: 100, fill: PAGE },
    { type: 'rect', x: 2.5, y: 1.8, w: 95, h: 96.4, fill: CARD, texture: 'grit', textureStrength: 0.3, stroke: 'accent', strokeWidth: 0.5, radius: 2.5 },
    { type: 'text', field: 'name', x: 6, y: 3.6, w: 65, h: 8.4, font: 'title', size: 7.2, minSize: 4, color: NAME, valign: 'middle' },
    { when: levelText.when, type: 'rect', x: 73, y: 4.4, w: 21, h: 6.6, fill: '#24221a', stroke: '#5b5540', strokeWidth: 0.3, radius: 1 },
    {
      ...levelText, type: 'text', x: 73, y: 4.4, w: 21, h: 6.6, font: 'body', size: 4.8, minSize: 3, color: NAME, align: 'center', valign: 'middle',
    },
  ];
}

export const divider = { type: 'rect', x: 6, y: 18.8, w: 88, h: 0.25, fill: 'accent', opacity: 0.55 };

// The dark footer strip at the bottom of the card.
export function footer(entry) {
  return [
    { when: entry.field, type: 'rect', x: 4.5, y: 88.6, w: 91, h: 7.8, fill: PANEL, stroke: LINE, strokeWidth: 0.3, radius: 1.2 },
    { when: entry.field, type: 'text', ...entry, x: 7, y: 88.8, w: 86, h: 7.4, font: 'body', size: 3.8, minSize: 2.2, color: MUTED, valign: 'middle' },
  ];
}
