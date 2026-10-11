import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LAYOUTS, getLayout, matchesColumns } from '../../layouts/index.js';

test('layout ids are unique and old ids still resolve', () => {
  const ids = LAYOUTS.map((l) => l.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(getLayout('flagonquest').id, 'flagonquest');
  assert.equal(getLayout('flagonquest-technique').id, 'flagonquest');
  assert.equal(getLayout('flagonquest-item').id, 'flagonquest');
  assert.equal(getLayout('nope'), null);
});

test('matchColumns accepts one list or several', () => {
  const fq = getLayout('flagonquest');
  assert.equal(matchesColumns(fq, ['name', 'level_min', 'action', 'prereqs']), true);
  assert.equal(matchesColumns(fq, ['name', 'category', 'slot', 'damage']), true);
  assert.equal(matchesColumns(fq, ['name', 'category', 'slot']), false);
  assert.equal(matchesColumns({ matchColumns: ['a', 'b'] }, ['a', 'b', 'c']), true);
  assert.equal(matchesColumns({ matchColumns: ['a', 'b'] }, ['a']), false);
  assert.equal(matchesColumns(getLayout('default'), ['name']), false);
});
