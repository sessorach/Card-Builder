import { test } from 'node:test';
import assert from 'node:assert/strict';
import { unknownBlendItems, parseBlend, partRgb, partMottle, quantileThresholds, paintBlend, hashSeed, BLEND_STYLES } from '../../js/blend.js';

const COLORS = { Instinct: '#00ff00', Knowledge: '#0000ff', Passion: '#ff0000' };
const MODS = { inverted: { mix: '#000000', amount: 0.5 } };

test('reads weights and modifiers from a list cell', () => {
  const parts = parseBlend('Knowledge 2, Inverted Passion, passion (inverted) 1.5, Nonsense 4, Instinct 0', COLORS, MODS);
  assert.deepEqual(parts.map((p) => [p.key, p.weight, p.modifiers]), [
    ['knowledge', 2, []],
    ['passion', 1.75, ['inverted']], // no number: the average of 2 and 1.5
    ['passion', 1.5, ['inverted']],
  ]);
  assert.deepEqual(parseBlend('', COLORS), []);
  assert.deepEqual(partRgb(parts[0], MODS), [0, 0, 255]);
  assert.deepEqual(partRgb(parts[1], MODS), [128, 0, 0]);
});

test('each color covers its share of the area', () => {
  for (const style of BLEND_STYLES.filter((s) => s !== 'solid')) {
    const w = 60;
    const h = 84;
    const data = new Uint8ClampedArray(w * h * 4);
    const parts = parseBlend('Knowledge 2, Passion 1', COLORS);
    paintBlend(data, w, h, { parts, rgb: parts.map((p) => partRgb(p)), style, seed: hashSeed('x') });
    let blue = 0;
    let red = 0;
    for (let i = 0; i < w * h; i++) data[i * 4 + 2] > data[i * 4] ? blue++ : red++;
    assert.ok(Math.abs(blue / (w * h) - 2 / 3) < 0.04, `${style}: ${blue / (w * h)}`);
  }
});

test('solid uses the strongest color; thresholds split by weight', () => {
  const data = new Uint8ClampedArray(4 * 4 * 4);
  const parts = parseBlend('Instinct 1, Passion 3', COLORS);
  paintBlend(data, 4, 4, { parts, rgb: parts.map((p) => partRgb(p)), style: 'solid' });
  assert.deepEqual([...data.slice(0, 3)], [255, 0, 0]);
  const th = quantileThresholds([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], [1, 2]);
  assert.deepEqual(th, [3, 11]);
});

test('modifiers can desaturate, darken and vein a part', () => {
  const mods = { blight: { saturate: 0.5, darken: 0.5, mottle: 0.4 }, faint: { mottle: 0.2 } };
  const [part] = parseBlend('Faint Blight Passion', COLORS, mods);
  // red → half saturation around its gray (77) → halved
  assert.deepEqual(partRgb(part, mods), [83, 19, 19]);
  assert.equal(partMottle(part, mods), 0.4);
  assert.equal(partMottle(parseBlend('Passion', COLORS, mods)[0], mods), 0);
});

test('finds list items that name no color', () => {
  assert.deepEqual(unknownBlendItems('Knowledge 2, Instict 1, inverted PASSION, 3', COLORS), ['Instict 1', '3']);
  assert.deepEqual(unknownBlendItems('', COLORS), []);
});

test('an item with no number takes the average share of the numbered ones', () => {
  const parts = parseBlend('Knowledge 6, Passion 4, Instinct', COLORS);
  assert.deepEqual(parts.map((p) => p.weight), [6, 4, 5]);
  assert.deepEqual(parseBlend('Knowledge, Passion', COLORS).map((p) => p.weight), [1, 1]);
});
