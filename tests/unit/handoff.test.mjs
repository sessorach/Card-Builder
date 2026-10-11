import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encodeHandoff, decodeHandoff, handoffData } from '../../js/handoff.js';
import { rowsToCards } from '../../js/spreadsheet.js';

test('cards survive the trip through a link', async () => {
  const hash = await encodeHandoff({
    title: 'Aria — FlagonQuest',
    layout: 'flagonquest',
    columns: ['Name', 'Count', 'Deck', 'Level Min', 'Effects', 'built_features'],
    rows: [['Shield Bash', 2, 'Aria: Techniques', 2, 'Make a weapon attack.', '**Lunging ×2** — Shift up to 2 times.\n**Wind Slash** — +2 range.']],
  });
  assert.match(hash, /^#import=[A-Za-z0-9_-]+$/);
  const { title, layout, rows } = await decodeHandoff(handoffData(hash));
  assert.equal(title, 'Aria — FlagonQuest');
  assert.equal(layout, 'flagonquest');
  const { cards, columns } = rowsToCards(rows);
  assert.deepEqual(columns, ['name', 'count', 'deck', 'level_min', 'text', 'built_features']);
  assert.equal(cards[0].count, 2);
  assert.equal(cards[0].deck, 'Aria: Techniques');
  assert.match(cards[0].fields.built_features, /Lunging ×2.*\n.*Wind Slash/s);
});

test('other hashes and damaged links are handled', async () => {
  assert.equal(handoffData('#columns'), null);
  assert.equal(handoffData(''), null);
  assert.equal(handoffData('#import=abc'), 'abc');
  await assert.rejects(decodeHandoff('not-really-data'), /damaged or incomplete/);
  const future = handoffData(await encodeHandoff({ v: 99, columns: ['name'], rows: [] }));
  await assert.rejects(decodeHandoff(future), /newer version/);
  const broken = handoffData(await encodeHandoff({ columns: 'name', rows: [] }));
  await assert.rejects(decodeHandoff(broken), /damaged or incomplete/);
});
