import test from 'node:test';
import assert from 'node:assert/strict';
import { planSheets, sheetCardPx, buildSavedObject, imageUrl, slug, cardDescription, contentHash, cloudSheetName, cloudBackName, isLink, looksLikeSteamCloud, MAX_PER_SHEET } from '../../js/tts.js';

const seeded = (seed = 1) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

test('plans sheets of at most 69 cards with grids of at least 2 × 2', () => {
  assert.deepEqual(planSheets(1), [{ start: 0, count: 1, cols: 2, rows: 2 }]);
  assert.deepEqual(planSheets(4), [{ start: 0, count: 4, cols: 2, rows: 2 }]);
  assert.deepEqual(planSheets(8), [{ start: 0, count: 8, cols: 3, rows: 3 }]);
  assert.deepEqual(planSheets(20), [{ start: 0, count: 20, cols: 4, rows: 5 }]);
  assert.deepEqual(planSheets(60), [{ start: 0, count: 60, cols: 9, rows: 7 }]);
  assert.deepEqual(planSheets(69), [{ start: 0, count: 69, cols: 10, rows: 7 }]);
  const two = planSheets(70);
  assert.equal(two.length, 2);
  assert.deepEqual(two[1], { start: 69, count: 1, cols: 2, rows: 2 });
  assert.equal(MAX_PER_SHEET, 69);
});

test('scales sheet cells down to the limit, never up', () => {
  const card = { width: 744, height: 1039 };
  assert.deepEqual(sheetCardPx(card, 10, 7, 8192), card);
  const small = sheetCardPx(card, 10, 7, 4096);
  assert.ok(small.width * 10 <= 4096 && small.height * 7 <= 4096);
  assert.ok(Math.abs(small.width / small.height - 744 / 1039) < 0.01);
});

test('local images get a plain path inside Saved Objects/Card Builder/images', () => {
  const local = (savedObjects) => imageUrl('a b.jpg', { mode: 'local', savedObjects });
  const windows = 'C:\\Users\\me\\Saved Objects\\Card Builder\\images\\a b.jpg';
  assert.equal(local('C:\\Users\\me\\Saved Objects'), windows);
  assert.equal(local('C:\\Users\\me\\Saved Objects\\'), windows);
  // Easy slips: "Copy as path" quotes, a file:/// address, or the Card Builder folder itself.
  assert.equal(local('"C:\\Users\\me\\Saved Objects"'), windows);
  assert.equal(local('file:///C:/Users/me/Saved Objects'), windows);
  assert.equal(local('C:\\Users\\me\\Saved Objects\\Card Builder'), windows);
  assert.equal(local('C:/Users/me/Saved Objects/card builder/images/'), windows);
  // Linux and Mac need a file:/// address: TTS treats a bare /home/… path as a web address.
  assert.equal(
    local('/Users/me/Library/Tabletop Simulator/Saves/Saved Objects/'),
    'file:///Users/me/Library/Tabletop Simulator/Saves/Saved Objects/Card Builder/images/a b.jpg',
  );
  assert.equal(
    local('file:///home/me/.local/share/Tabletop Simulator/Saves/Saved Objects'),
    'file:///home/me/.local/share/Tabletop Simulator/Saves/Saved Objects/Card Builder/images/a b.jpg',
  );
  assert.throws(() => imageUrl('a.jpg', { mode: 'local', savedObjects: '~/TTS' }));
});

test('web images get the base address plus the encoded file name', () => {
  assert.equal(imageUrl('a b.jpg', { mode: 'web', baseUrl: 'https://x.io/decks' }), 'https://x.io/decks/a%20b.jpg');
  assert.equal(imageUrl('a.jpg', { mode: 'web', baseUrl: ' "https://x.io/decks/" ' }), 'https://x.io/decks/a.jpg');
});

test('slug makes safe file names', () => {
  assert.equal(slug('Fire Deck: Ëmber!'), 'fire-deck-ember');
  assert.equal(slug('***'), 'deck');
});

test('saved object: deck with copies across two sheets', () => {
  const cards = Array.from({ length: 70 }, (_, i) => ({ name: `C${i}`, count: i === 0 ? 3 : 1, fields: { text: '**x**' } }));
  const plan = planSheets(cards.length);
  const sheets = plan.map((s, i) => ({ ...s, faceUrl: `face${i}` }));
  const saved = buildSavedObject({ deck: { name: 'Big', cards }, sheets, backUrl: 'back', rng: seeded() });
  const deck = saved.ObjectStates[0];

  assert.equal(deck.Name, 'DeckCustom');
  assert.equal(deck.Nickname, 'Big');
  assert.equal(deck.ContainedObjects.length, 72);
  assert.equal(deck.DeckIDs.length, 72);
  const keys = Object.keys(deck.CustomDeck).map(Number);
  assert.equal(keys.length, 2);
  assert.notEqual(keys[0], keys[1]);

  const [k1, k2] = [Object.entries(deck.CustomDeck).find(([, d]) => d.FaceURL === 'face0')[0], Object.entries(deck.CustomDeck).find(([, d]) => d.FaceURL === 'face1')[0]].map(Number);
  assert.deepEqual(deck.DeckIDs.slice(0, 4), [k1 * 100, k1 * 100, k1 * 100, k1 * 100 + 1]);
  assert.equal(deck.DeckIDs.at(-1), k2 * 100);
  assert.equal(deck.CustomDeck[k1].NumWidth, 10);
  assert.equal(deck.CustomDeck[k1].NumHeight, 7);
  assert.equal(deck.CustomDeck[k1].BackURL, 'back');
  assert.equal(deck.CustomDeck[k1].BackIsHidden, true);

  const card = deck.ContainedObjects[0];
  assert.equal(card.Name, 'Card');
  assert.equal(card.Description, '[b]x[/b]');
  assert.deepEqual(Object.keys(card.CustomDeck), [String(k1)]);
  const guids = new Set([deck.GUID, ...deck.ContainedObjects.map((c) => c.GUID)]);
  assert.ok(guids.size > 60); // random 6-hex GUIDs, effectively unique
});

test('saved object: a single card is a Card, not a deck', () => {
  const sheets = planSheets(1).map((s) => ({ ...s, faceUrl: 'f' }));
  const saved = buildSavedObject({ deck: { name: 'One', cards: [{ name: 'Solo', count: 1, fields: {} }] }, sheets, backUrl: 'b', rng: seeded() });
  assert.equal(saved.ObjectStates[0].Name, 'Card');
  assert.equal(saved.ObjectStates[0].Nickname, 'Solo');
});

test('card descriptions include tags and any extra columns, labelled', () => {
  assert.equal(
    cardDescription({ name: 'X', art: 'x.png', type: 'Thug', tags: 'Crew, Leader', cost: '5', text: '**Go.**', strengf: '4', helf: '', steal: '2', street_cred: '1', flavor: 'Yo' }),
    '[b]Thug — Crew · Leader[/b]\nCost: 5\n[b]Go.[/b]\n[b]Strengf 4 · Steal 2 · Street cred 1[/b]\n[i]Yo[/i]',
  );
  assert.equal(cardDescription({ name: 'Plain', type: 'Event', text: 'Hi' }), '[b]Event[/b]\nHi');
});

test('content hashes are stable, 16 hex characters, and differ for different bytes', () => {
  const a = contentHash(new Uint8Array([1, 2, 3]));
  assert.match(a, /^[0-9a-f]{16}$/);
  assert.equal(contentHash(new Uint8Array([1, 2, 3])), a);
  assert.notEqual(contentHash(new Uint8Array([1, 2, 4])), a);
  assert.notEqual(contentHash(new Uint8Array([])), a);
});

test('Steam Cloud file names carry the content hash', () => {
  assert.equal(cloudSheetName('Street Deck', 0, '0123456789abcdef'), 'street-deck-sheet1-0123456789.jpg');
  assert.equal(cloudBackName('0123456789abcdef'), 'back-0123456789.jpg');
});

test('pasted links are recognized, and Steam Cloud links are told apart', () => {
  const steam = 'https://steamusercontent-a.akamaihd.net/ugc/1234567890/ABCDEF0123/';
  assert.ok(isLink(steam));
  assert.ok(isLink(` "${steam}" `));
  assert.ok(looksLikeSteamCloud(steam));
  assert.ok(looksLikeSteamCloud('https://steamusercontent.com/ugc/123/ABC/'));
  assert.ok(isLink('https://example.com/a.jpg'));
  assert.ok(!looksLikeSteamCloud('https://example.com/a.jpg'));
  assert.ok(!isLink('not a link'));
  assert.ok(!isLink('https://has space.com/a'));
  assert.ok(!isLink(''));
});

test('a layout hover list picks, labels and orders the description', () => {
  const fields = { name: 'Brace', action: '1 AP', cost: '', text: 'Gain **3** Protected.', flavor: 'Breathe.', id: 'T001' };
  const hover = [{ field: 'action', label: 'Action' }, { field: 'cost', label: 'Cost' }, 'text', { field: 'flavor', italic: true }];
  assert.equal(cardDescription(fields, hover), '[b]Action:[/b] 1 AP\nGain [b]3[/b] Protected.\n[i]Breathe.[/i]');
});
