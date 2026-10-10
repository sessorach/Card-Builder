// Classic: framed card with a title bar, art window, type line, rules box and
// a stats badge. Coordinates are percentages of the card (x/w of its width,
// y/h of its height); sizes, radii and stroke widths are percentages of its width.
export default {
  id: 'classic',
  name: 'Classic',
  description: 'Framed card: title bar, art window, type line, rules box, stats badge.',
  defaultColor: '#8a5a2b',
  elements: [
    { type: 'rect', x: 0, y: 0, w: 100, h: 100, fill: 'accentDark' },
    { type: 'rect', x: 2.5, y: 1.8, w: 95, h: 96.4, fill: 'accent', radius: 2.5 },

    // Title bar
    { type: 'rect', x: 4.5, y: 3.2, w: 91, h: 8, fill: 'paper', stroke: 'ink', strokeWidth: 0.4, radius: 1.6 },
    { type: 'text', field: 'name', x: 7, y: 3.2, w: 68, h: 8, font: 'title', size: 6.2, minSize: 3.5, color: 'ink', valign: 'middle' },
    { type: 'rect', when: 'cost', x: 79, y: 3.9, w: 14.5, h: 6.6, fill: 'accentDark', stroke: 'paper', strokeWidth: 0.5, radius: 3.3 },
    { type: 'text', when: 'cost', field: 'cost', x: 79, y: 3.9, w: 14.5, h: 6.6, font: 'title', size: 5.6, minSize: 3, color: 'paper', align: 'center', valign: 'middle' },

    // Art
    { type: 'image', field: 'art', x: 5.5, y: 12.6, w: 89, h: 43, stroke: 'ink', strokeWidth: 0.5 },

    // Type line
    { type: 'rect', x: 4.5, y: 56.6, w: 91, h: 6.4, fill: 'paper', stroke: 'ink', strokeWidth: 0.4, radius: 1.6 },
    { type: 'text', join: ['type', 'subtype'], sep: ' — ', x: 7, y: 56.6, w: 86, h: 6.4, font: 'body', weight: 'bold', size: 4.6, minSize: 3, color: 'ink', valign: 'middle' },

    // Rules + flavor
    { type: 'rect', x: 5.5, y: 64, w: 89, h: 30.6, fill: 'paperLight', stroke: 'ink', strokeWidth: 0.3, radius: 1 },
    { type: 'text', parts: ['text', { field: 'flavor', italic: true }], x: 8.5, y: 65.6, w: 83, h: 27.4, font: 'body', size: 5.3, minSize: 2.8, lineHeight: 1.18, color: 'ink', valign: 'middle' },

    // Stats badge
    { type: 'rect', when: 'stats', x: 70, y: 91.2, w: 25.5, h: 6.2, fill: 'paper', stroke: 'ink', strokeWidth: 0.5, radius: 1.6 },
    { type: 'text', when: 'stats', field: 'stats', x: 70, y: 91.2, w: 25.5, h: 6.2, font: 'title', size: 5.2, minSize: 3, color: 'ink', align: 'center', valign: 'middle' },
  ],
};
