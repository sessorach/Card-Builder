import test from 'node:test';
import assert from 'node:assert/strict';
import { templateColumns, templateCsv } from '../../js/template.js';
import { parseDelimited, rowsToCards } from '../../js/spreadsheet.js';
import { LAYOUTS, getLayout } from '../../layouts/index.js';

test('Street template lists its columns in drawing order, without art or color', () => {
  assert.deepEqual(templateColumns(getLayout('street')), [
    'name', 'count', 'deck', 'cost', 'text', 'flavor', 'type', 'tags', 'strengf', 'helf', 'steal', 'equip_cost',
  ]);
});

test('list columns carry a note in the template header, and it reads back cleanly', () => {
  const csv = templateCsv(getLayout('street'));
  assert.equal(csv, 'name,count,deck,cost,text,flavor,type,tags (separate with commas),strengf,helf,steal,equip_cost\r\n');
  const { cards, columns } = rowsToCards(parseDelimited(`${csv}Boss,1,,5,,,Thug,"Crew, Leader",4,3,2,\r\n`));
  assert.ok(columns.includes('tags'));
  assert.equal(cards[0].fields.tags, 'Crew, Leader');
});

test('layouts without colorBy get a color column', () => {
  assert.deepEqual(templateColumns(getLayout('default')), [
    'name', 'count', 'deck', 'cost', 'type', 'subtype', 'text', 'flavor', 'stats', 'color',
  ]);
});

test('every layout produces a header-only CSV starting with name', () => {
  for (const layout of LAYOUTS) {
    const csv = templateCsv(layout);
    assert.match(csv, /^name,count,deck,/);
    assert.equal(csv.split('\r\n').filter(Boolean).length, 1, layout.id);
  }
});

test('fixed labels and condition-only fields are handled', () => {
  const layout = {
    elements: [
      { type: 'text', text: 'LABEL' },
      { type: 'rect', when: ['rarity'] },
      { type: 'text', join: ['type', { field: 'tags', list: true }] },
    ],
  };
  assert.deepEqual(templateColumns(layout), ['name', 'count', 'deck', 'type', 'tags', 'rarity', 'color']);
});
