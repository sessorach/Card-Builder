import test from 'node:test';
import assert from 'node:assert/strict';
import { parseDelimited, detectDelimiter, rowsToCards, groupByDeck, normalizeHeader } from '../../js/spreadsheet.js';

test('parses quoted fields, doubled quotes and embedded newlines', () => {
  const rows = parseDelimited('name,text\r\n"Imp","Says ""hi""\nand burns"\nGolem,plain\n');
  assert.deepEqual(rows, [
    ['name', 'text'],
    ['Imp', 'Says "hi"\nand burns'],
    ['Golem', 'plain'],
  ]);
});

test('strips a UTF-8 BOM and keeps a trailing field with no newline', () => {
  assert.deepEqual(parseDelimited('\ufeffa,b\n1,'), [['a', 'b'], ['1', '']]);
});

test('detects tab and semicolon delimiters', () => {
  assert.equal(detectDelimiter('a\tb\tc\n'), '\t');
  assert.equal(detectDelimiter('a;b;c\n'), ';');
  assert.equal(detectDelimiter('a,b\n'), ',');
  assert.equal(detectDelimiter('a,b\n', 'cards.tsv'), '\t');
});

test('normalizes header aliases', () => {
  assert.equal(normalizeHeader(' Card Name '), 'name');
  assert.equal(normalizeHeader('Qty'), 'count');
  assert.equal(normalizeHeader('Rules Text'), 'text');
  assert.equal(normalizeHeader('Power Level'), 'power_level');
  assert.equal(normalizeHeader('Tags (separate with commas)'), 'tags');
  assert.equal(normalizeHeader('Qty (copies in deck)'), 'count');
  // FlagonQuest's own spreadsheet headers.
  assert.equal(normalizeHeader('Description (Fluff)'), 'flavor');
  assert.equal(normalizeHeader('Effects'), 'text');
  assert.equal(normalizeHeader('Prereqs (Full)'), 'prereqs');
  assert.equal(normalizeHeader('Level Min'), 'level_min');
  assert.equal(normalizeHeader('Relevant Skills'), 'relevant_skills');
});

test('builds cards with counts, decks and warnings', () => {
  const { cards, warnings } = rowsToCards([
    ['Name', 'Qty', 'Deck', 'Layout', 'Image'],
    ['Imp', '3', 'Fire', 'Full-Art', 'imp.png'],
    ['Skipped', '0', '', '', ''],
    ['', '', '', '', 'orphan.png'],
    ['Bad Count', 'many', '', '', ''],
    ['', '', '', '', ''],
  ]);
  assert.equal(cards.length, 3);
  assert.deepEqual(
    cards.map((c) => [c.name, c.count, c.deck, c.layout, c.art]),
    [
      ['Imp', 3, 'Fire', 'full-art', 'imp.png'],
      ['Card 4', 1, 'Deck', '', 'orphan.png'],
      ['Bad Count', 1, 'Deck', '', ''],
    ],
  );
  assert.equal(warnings.length, 2);
});

test('groups cards into decks in first-seen order', () => {
  const { cards } = rowsToCards([['name', 'deck'], ['a', 'X'], ['b', 'Y'], ['c', 'X']]);
  assert.deepEqual(
    groupByDeck(cards).map((d) => [d.name, d.cards.map((c) => c.name)]),
    [['X', ['a', 'c']], ['Y', ['b']]],
  );
});
