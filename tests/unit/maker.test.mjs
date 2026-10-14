import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fieldLabel, formFields, visibleFields, blendRows, blendText, rowsToCsv } from '../../js/maker.js';
import { getLayout } from '../../layouts/index.js';
import { parseDelimited, rowsToCards } from '../../js/spreadsheet.js';

const ross = getLayout('rossquest');
const fq = getLayout('flagonquest');

test('labels read like words', () => {
  assert.equal(fieldLabel('to_hit'), 'To hit');
  assert.equal(fieldLabel('w'), '[W]');
});

test('each column gets the right kind of box', () => {
  const kinds = Object.fromEntries(formFields(ross).map((f) => [f.column, f.kind]));
  assert.equal(kinds.aura, 'blend');
  assert.equal(kinds.blend, 'style');
  assert.equal(kinds.text, 'long');
  assert.equal(kinds.tags, 'list');
  assert.equal(kinds.name, 'text');
  // Type picks between ally and action boxes: a drop-down, right after the name.
  const fields = formFields(ross);
  assert.deepEqual(fields.slice(0, 4).map((f) => f.column), ['name', 'type', 'tags', 'aura']);
  assert.deepEqual(fields[1].choices, ['Ally', 'Action']);
  assert.ok(!fields.find((f) => f.column === 'immunities').switches, 'a column only tested for a value stays in place');
  const fqFields = formFields(fq);
  assert.deepEqual(fqFields.slice(0, 3).map((f) => f.column), ['name', 'category', 'tags']);
  assert.deepEqual(formFields(getLayout('default')).slice(0, 3).map((f) => f.column), ['name', 'count', 'deck']);
  assert.ok(fqFields.find((f) => f.column === 'category').switches);
  assert.ok(fqFields.find((f) => f.column === 'category').options.includes('Weapon'));
});

test('boxes follow the card type', () => {
  const ally = visibleFields(ross, { type: 'Ally' });
  assert.ok(ally.has('armor') && ally.has('aura') && ally.has('name'));
  assert.ok(!ally.has('to_hit') && !ally.has('crit'));
  const action = visibleFields(ross, { type: 'Action' });
  assert.ok(action.has('to_hit') && action.has('crit') && action.has('aura'));
  assert.ok(!action.has('armor') && !action.has('immunities'));
  // FlagonQuest: a category makes the row an item.
  assert.ok(visibleFields(fq, {}).has('level_min'));
  assert.ok(!visibleFields(fq, {}).has('slot'));
  const item = visibleFields(fq, { category: 'Weapon' });
  assert.ok(item.has('slot') && item.has('category') && !item.has('level_min'));
});

test('the color picker reads and writes blend cells', () => {
  const rows = blendRows('knowledge 2, Inverted passion, Instinct (inverted) 1.5', ross.elements[0].colors, ross.elements[0].modifiers);
  assert.deepEqual(rows, [
    { color: 'Knowledge', weight: 2, modifiers: [] },
    { color: 'Passion', weight: null, modifiers: ['Inverted'] },
    { color: 'Instinct', weight: 1.5, modifiers: ['Inverted'] },
  ]);
  assert.equal(blendText(rows), 'Knowledge 2, Inverted Passion, Inverted Instinct 1.5');
  assert.equal(blendText([{ color: 'Passion', weight: 0, modifiers: [] }]), '');
  // A 1 that was typed stays on the card; a blank is just the name.
  assert.equal(blendText([{ color: 'Instinct', weight: 1, modifiers: [] }, { color: 'Passion', weight: '', modifiers: [] }]), 'Instinct 1, Passion');
  assert.deepEqual(blendRows('Instinct 1', ross.elements[0].colors).map((r) => r.weight), [1]);
});

test('the CSV reads back as the same cards', () => {
  const csv = rowsToCsv(['name', 'count', 'deck', 'text', 'tags'], [
    { name: 'Rally', text: 'Each ally gains 1 Resolve.\nThen draw.', tags: 'Command, "Loud"' },
    { name: 'Brace', count: '2' },
  ]);
  assert.match(csv, /^name,count,text,tags\r\n/);
  const { cards } = rowsToCards(parseDelimited(csv, ','));
  assert.equal(cards.length, 2);
  assert.equal(cards[0].fields.text, 'Each ally gains 1 Resolve.\nThen draw.');
  assert.equal(cards[0].fields.tags, 'Command, "Loud"');
  assert.equal(cards[1].count, 2);
});
