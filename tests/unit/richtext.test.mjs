import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRich, layoutRich, fitRich, joinParts, joinInline, splitList, affix, signed, toTtsText, textHeight, PARAGRAPH_GAP } from '../../js/richtext.js';

// Monospace fake: every character is 0.5em wide.
const measure = (text, style, size) => text.length * size * 0.5;

test('parses bold, italic, icons, breaks and escapes', () => {
  const atoms = parseRich('Deal **2** {Fire} to *it*.\\nDone \\*not italic\\*');
  assert.deepEqual(
    atoms.map((a) => (a.kind === 'break' ? '|' : a.kind === 'icon' ? `{${a.name}}` : `${a.bold ? 'B:' : ''}${a.italic ? 'I:' : ''}${a.space ? '_' : ''}${a.text}`)),
    ['Deal', 'B:_2', '{fire}', '_to', 'I:_it', '.', '|', 'Done', '_*not', '_italic*'],
  );
});

test('unknown brace content stays as text', () => {
  const atoms = parseRich('a {not an icon} b');
  assert.ok(atoms.every((a) => a.kind === 'text'));
});

test('wraps on spaces and never splits glued atoms', () => {
  const atoms = parseRich('aaaa bbbb **cc**dd');
  const { lines } = layoutRich(atoms, { maxWidth: 20, size: 4, measure }); // 10 chars per line
  assert.deepEqual(
    lines.map((l) => l.items.map((i) => i.atom.text).join('+')),
    ['aaaa+bbbb', 'cc+dd'],
  );
});

test('fitRich shrinks text until it fits the box', () => {
  const atoms = parseRich('one two three four five six seven eight nine ten');
  const fit = fitRich(atoms, { boxWidth: 100, boxHeight: 30, maxSize: 20, minSize: 4, lineHeight: 1, measure });
  assert.ok(fit.fits);
  assert.ok(fit.size < 20 && fit.size >= 4);
  assert.ok(fit.lines.length * fit.size <= 30);
});

test('fitRich reports overflow at the minimum size', () => {
  const atoms = parseRich('x '.repeat(500));
  const fit = fitRich(atoms, { boxWidth: 50, boxHeight: 10, maxSize: 10, minSize: 8, lineHeight: 1, measure });
  assert.equal(fit.fits, false);
  assert.equal(fit.size, 8);
});

test('joinParts inserts breaks between non-empty parts', () => {
  const atoms = joinParts([parseRich('rules'), parseRich(''), parseRich('flavor', { italic: true })]);
  assert.deepEqual(atoms.map((a) => a.kind), ['text', 'break', 'text']);
  assert.equal(atoms[2].italic, true);
});

test('toTtsText converts markup to TTS BBCode', () => {
  assert.equal(toTtsText('**Guard.** Hit *hard*\\n\\*x'), '[b]Guard.[/b] Hit [i]hard[/i]\n*x');
});

test('paragraph gaps between parts add height', () => {
  const atoms = joinParts([parseRich('rules'), parseRich('flavor')]);
  const { lines } = layoutRich(atoms, { maxWidth: 1000, size: 10, measure });
  assert.deepEqual(lines.map((l) => l.gap), [0, PARAGRAPH_GAP]);
  assert.equal(textHeight(lines, 10, 1), 10 + 10 * (1 + PARAGRAPH_GAP));
});

test('color passes through to every atom', () => {
  const atoms = parseRich('a **b** {x}', { color: 'accent' });
  assert.ok(atoms.every((a) => a.color === 'accent'));
  assert.equal(parseRich('a')[0].color, undefined);
});

test('joinInline joins chunks with a separator and keeps wrap points', () => {
  const atoms = joinInline([parseRich('Crew', { bold: true }), [], parseRich('Hustler'), parseRich('Night Shift')], ' · ');
  assert.deepEqual(
    atoms.map((a) => `${a.space ? '_' : ''}${a.bold ? 'B:' : ''}${a.text}`),
    ['B:Crew', '_·', '_Hustler', '_·', '_Night', '_Shift'],
  );
  const glued = joinInline([parseRich('a'), parseRich('b')], '/');
  assert.deepEqual(glued.map((a) => [a.text, a.space]), [['a', false], ['/', false], ['b', false]]);
  const spaced = joinInline([parseRich('a'), parseRich('b')], ' ');
  assert.deepEqual(spaced.map((a) => [a.text, a.space]), [['a', false], ['b', true]]);
});

test('splitList splits on commas, semicolons and pipes', () => {
  assert.deepEqual(splitList(' Crew, Hustler;Night Shift | , '), ['Crew', 'Hustler', 'Night Shift']);
  assert.deepEqual(splitList(''), []);
});

test('signed shows plain numbers with their sign', () => {
  assert.equal(signed('1'), '+1');
  assert.equal(signed('0'), '+0');
  assert.equal(signed('-1'), '−1');
  assert.equal(signed('+2'), '+2');
  assert.equal(signed('[Level]'), '[Level]');
  assert.equal(signed(''), '');
});

test('affix adds a prefix or suffix only when missing', () => {
  assert.equal(affix('3', { prefix: '$' }), '$3');
  assert.equal(affix('$3', { prefix: '$' }), '$3');
  assert.equal(affix('', { prefix: '$' }), '');
  assert.equal(affix('5', { suffix: '%' }), '5%');
});
