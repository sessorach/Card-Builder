// Text Only: no art window, large readable rules text. Good for spells,
// events, reference cards and quick prototypes.
export default {
  id: 'text-only',
  name: 'Text Only',
  description: 'No art; big centered rules text. For spells, events and prototypes.',
  defaultColor: '#6b3d6e',
  elements: [
    { type: 'rect', x: 0, y: 0, w: 100, h: 100, fill: 'paper' },
    { type: 'rect', x: 3, y: 2.2, w: 94, h: 95.6, stroke: 'accent', strokeWidth: 1.4, radius: 3 },
    { type: 'rect', x: 5, y: 3.6, w: 90, h: 92.8, stroke: 'accent', strokeWidth: 0.3, radius: 2 },

    { type: 'rect', when: 'cost', x: 8, y: 5.5, w: 13, h: 9.3, fill: 'accent', radius: 6.5 },
    { type: 'text', when: 'cost', field: 'cost', x: 8, y: 5.5, w: 13, h: 9.3, font: 'title', size: 6, minSize: 3, color: 'paper', align: 'center', valign: 'middle' },

    { type: 'text', field: 'name', x: 12, y: 16, w: 76, h: 11, font: 'title', size: 9.5, minSize: 4, color: 'ink', align: 'center', valign: 'middle' },
    { type: 'text', join: ['type', 'subtype'], sep: ' — ', x: 12, y: 27, w: 76, h: 5, font: 'body', italic: true, size: 5.6, minSize: 3, color: 'accentDark', align: 'center', valign: 'middle' },
    { type: 'rect', x: 30, y: 33.5, w: 40, h: 0.35, fill: 'accent' },

    { type: 'text', field: 'text', x: 11, y: 37, w: 78, h: 40, font: 'body', size: 7.6, minSize: 3, lineHeight: 1.22, color: 'ink', align: 'center', valign: 'middle' },
    { type: 'text', field: 'flavor', x: 14, y: 78, w: 72, h: 10, font: 'body', italic: true, size: 5.2, minSize: 2.6, lineHeight: 1.15, color: 'accentDark', align: 'center', valign: 'middle' },

    { type: 'text', when: 'stats', field: 'stats', x: 30, y: 88.5, w: 40, h: 6, font: 'title', size: 5.6, minSize: 3, color: 'accent', align: 'center', valign: 'middle' },
  ],
};
