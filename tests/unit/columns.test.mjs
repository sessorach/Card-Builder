import { test } from 'node:test';
import assert from 'node:assert/strict';
import { columnHelp } from '../../js/columns.js';
import { templateColumns } from '../../js/template.js';
import { LAYOUTS } from '../../layouts/index.js';

test('every column a layout uses is explained for that layout', () => {
  for (const layout of LAYOUTS) {
    for (const column of templateColumns(layout)) {
      assert.ok(columnHelp(column, layout.id), `${layout.id}: no description for ${column}`);
    }
  }
});

test('a layout can word a shared column its own way', () => {
  assert.match(columnHelp('cost', 'street'), /\$/);
  assert.doesNotMatch(columnHelp('cost', 'default'), /\$/);
  assert.equal(columnHelp('nope', 'default'), '');
});
