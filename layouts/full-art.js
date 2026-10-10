// Full Art: the art covers the whole card; text sits on translucent panels.
export default {
  id: 'full-art',
  name: 'Full Art',
  description: 'Art fills the card; name and rules on translucent panels.',
  defaultColor: '#3b5b7a',
  elements: [
    { type: 'rect', x: 0, y: 0, w: 100, h: 100, fill: 'accentDark' },
    { type: 'image', field: 'art', x: 0, y: 0, w: 100, h: 100 },

    // Name banner
    { type: 'rect', x: 4, y: 3, w: 92, h: 8.4, fill: 'rgba(12, 10, 8, 0.62)', stroke: 'accentLight', strokeWidth: 0.4, radius: 4.2 },
    { type: 'text', field: 'name', x: 8, y: 3, w: 68, h: 8.4, font: 'title', size: 6.2, minSize: 3.5, color: '#f6efe3', valign: 'middle', shadow: true },
    { type: 'rect', when: 'cost', x: 80.2, y: 3.8, w: 14, h: 6.8, fill: 'accent', stroke: '#f6efe3', strokeWidth: 0.5, radius: 3.4 },
    { type: 'text', when: 'cost', field: 'cost', x: 80.2, y: 3.8, w: 14, h: 6.8, font: 'title', size: 5.6, minSize: 3, color: '#f6efe3', align: 'center', valign: 'middle' },

    // Rules panel
    { type: 'rect', x: 4, y: 62, w: 92, h: 34.5, fill: 'rgba(12, 10, 8, 0.7)', stroke: 'accentLight', strokeWidth: 0.4, radius: 2 },
    { type: 'text', join: ['type', 'subtype'], sep: ' — ', x: 8, y: 63, w: 84, h: 5.6, font: 'title', size: 4.2, minSize: 2.8, color: 'accentLight', valign: 'middle' },
    { type: 'rect', x: 8, y: 68.8, w: 84, h: 0.25, fill: 'accentLight' },
    { type: 'text', parts: ['text', { field: 'flavor', italic: true }], x: 8, y: 70, w: 84, h: 20, font: 'body', size: 5.2, minSize: 2.8, lineHeight: 1.18, color: '#f6efe3', valign: 'top' },

    // Stats
    { type: 'rect', when: 'stats', x: 70, y: 90.4, w: 23, h: 5.6, fill: 'accent', stroke: '#f6efe3', strokeWidth: 0.4, radius: 2.8 },
    { type: 'text', when: 'stats', field: 'stats', x: 70, y: 90.4, w: 23, h: 5.6, font: 'title', size: 4.8, minSize: 3, color: '#f6efe3', align: 'center', valign: 'middle' },
  ],
};
