import test from 'node:test';
import assert from 'node:assert/strict';
import { AssetStore, findArt, cardAccent } from '../../js/render.js';

const card = (name, fields = {}) => ({ name, fields: { name, ...fields } });

test('images match card names regardless of case, spacing and punctuation', () => {
  const assets = new AssetStore();
  assets.add('art/block-party-boss.png', 'boss');
  assets.add('Dealers_Choice.JPG', 'dealer');
  assets.add('mr. big.webp', 'big');
  assert.equal(assets.forName('Block Party Boss'), 'boss');
  assert.equal(assets.forName("Dealer's Choice"), 'dealer');
  assert.equal(assets.forName('Mr. Big'), 'big');
  assert.equal(assets.forName('Nobody'), null);
  assert.equal(assets.forName(''), null);
});

test('dropping a file again replaces the old image', () => {
  const assets = new AssetStore();
  assets.add('Boss.png', 'old');
  assets.add('folder/Boss.png', 'new');
  assets.add('boss.jpg', 'newest');
  assert.equal(assets.get('Boss.png'), 'new');
  assert.equal(assets.forName('Boss'), 'newest');
  assert.equal(assets.size, 2);
});

test('the art column wins over the card name, and falls back to it', () => {
  const assets = new AssetStore();
  assets.add('shared.png', 'shared');
  assets.add('Imp.png', 'imp');
  assert.equal(findArt(card('Imp', { art: 'shared.png' }), assets), 'shared');
  assert.equal(findArt(card('Imp', { art: 'shared' }), assets), 'shared');
  assert.equal(findArt(card('Imp'), assets), 'imp');
  assert.equal(findArt(card('Imp', { art: 'typo.png' }), assets), 'imp');
  assert.equal(findArt(card('Golem'), assets), null);
});

test('accent: color column, then the layout colorBy map, then nothing', () => {
  const layout = { colorBy: { field: 'type', colors: { Thug: '#8a5cf5', 'Dropped Move': '#6cc24a' } } };
  assert.equal(cardAccent(card('A', { type: 'thug' }), layout), '#8a5cf5');
  assert.equal(cardAccent(card('A', { type: ' dropped  move ' }), layout), '#6cc24a');
  assert.equal(cardAccent(card('A', { type: 'Thug', color: 'red' }), layout), 'red');
  assert.equal(cardAccent(card('A', { type: 'Other' }), layout), '');
  assert.equal(cardAccent(card('A', { type: 'Thug' }), {}), '');
});
