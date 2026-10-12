// End-to-end check in a real browser: loads the example deck, exports both
// zips, and inspects what's inside. Screenshots and downloads land in test-output/.
// Run: npm run test:e2e
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { encodeHandoff } from '../../js/handoff.js';

const ROOT = path.resolve(import.meta.dirname, '../..');
const OUT = path.join(ROOT, 'test-output');
const require = createRequire(import.meta.url);
// vendor/ is a browser UMD build; in this ESM package it registers a global.
require(path.join(ROOT, 'vendor/jszip.min.js'));
const { JSZip } = globalThis;

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.csv': 'text/csv', '.jpg': 'image/jpeg', '.png': 'image/png' };

function serve() {
  const server = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    const file = path.join(ROOT, decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
    if (!file.startsWith(ROOT)) return res.writeHead(403).end();
    try {
      const body = await readFile(file);
      res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' }).end(body);
    } catch {
      res.writeHead(404).end();
    }
  });
  return new Promise((resolve) => server.listen(0, () => resolve(server)));
}

// Width/height from a JPEG's SOF marker or a PNG's IHDR.
function imageSize(buf) {
  if (buf[0] === 0x89) return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  let i = 2;
  while (i < buf.length) {
    const marker = buf[i + 1];
    const len = buf.readUInt16BE(i + 2);
    if (marker >= 0xc0 && marker <= 0xc3) return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
    i += 2 + len;
  }
  throw new Error('no size');
}

async function saveDownload(page, buttonId) {
  const [download] = await Promise.all([page.waitForEvent('download'), page.click(`#${buttonId}`)]);
  const file = path.join(OUT, download.suggestedFilename());
  await download.saveAs(file);
  return { name: download.suggestedFilename(), zip: await JSZip.loadAsync(await readFile(file)) };
}

const tab = (page, name) => page.click(`[role="tab"][data-tab="${name}"]`);

// Examples load from the Templates & examples tab (the empty page has its own buttons).
async function loadExample(page, file) {
  await tab(page, 'start');
  await page.click(`.list [data-example="${file}"]`);
  assert.equal(await page.isVisible('[data-panel="cards"]'), true, 'loading an example shows the cards');
}

async function run() {
  await mkdir(OUT, { recursive: true });
  const server = await serve();
  const base = `http://localhost:${server.address().port}/`;
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 }, acceptDownloads: true });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && !/fonts\.g/.test(m.text()) && errors.push(m.text()));

  try {
    await page.goto(base);
    await page.waitForSelector('body[data-ready="true"]');

    // Example deck: 8 unique cards in two decks, art loaded.
    await page.screenshot({ path: path.join(OUT, 'start.png') });
    await page.click('.empty [data-example="example-cards.csv"]');
    await page.waitForFunction(() => document.querySelectorAll('.tile canvas').length === 8);
    assert.match(await page.textContent('#sheet-status'), /8 cards \(22 with copies\)/);
    assert.equal(await page.textContent('#art-status'), '6 images · all cards matched');
    assert.equal(await page.textContent('#card-count'), '8');
    assert.equal(await page.isHidden('#warnings'), true, 'example should load without warnings');
    await page.screenshot({ path: path.join(OUT, 'preview.png'), fullPage: true });

    // Lightbox
    await page.click('.tile >> nth=0');
    await page.screenshot({ path: path.join(OUT, 'lightbox.png') });
    await page.click('#lightbox');

    // The Data tab shows the spreadsheet as read, one row per card.
    await tab(page, 'data');
    assert.equal(await page.locator('table.data tbody tr').count(), 8);
    const dataHeaders = await page.$$eval('table.data thead th', (els) => els.map((el) => el.firstChild.textContent));
    assert.ok(['Row', 'Art', 'name', 'count', 'deck'].every((h) => dataHeaders.includes(h)), dataHeaders.join(','));
    await page.screenshot({ path: path.join(OUT, 'data.png') });
    await page.click('table.data tbody tr >> nth=0');
    assert.equal(await page.isVisible('#lightbox'), true, 'clicking a data row shows its card');
    await page.click('#lightbox');

    // The sidebar's TTS button opens the TTS tab.
    await page.click('#open-tts');
    assert.equal(await page.isVisible('#export-tts'), true);

    // Steam Cloud is the default; "This computer" needs a folder first.
    assert.equal(await page.isChecked('input[name="tts-mode"][value="cloud"]'), true);
    await page.check('input[name="tts-mode"][value="local"]');
    assert.equal(await page.isDisabled('#export-tts'), true);
    await page.fill('#tts-folder', 'C:\\Users\\tester\\Documents\\My Games\\Tabletop Simulator\\Saves\\Saved Objects');
    assert.equal(await page.isDisabled('#export-tts'), false);

    const tts = await saveDownload(page, 'export-tts');

    // The loading steps show this computer's steps, with the folder filled in.
    const localHelp = await page.innerText('#tts-load');
    assert.match(localHelp, /must go in exactly this folder, because that's where the deck looks for its pictures:\s+C:\\Users\\tester\\Documents/);
    assert.match(localHelp, /Only you will see these cards/);
    assert.doesNotMatch(localHelp, /Upload the pictures to your website/);
    assert.doesNotMatch(localHelp, /Everyone in your game sees the cards/);
    await page.click('#tts-help summary');
    assert.match(await page.innerText('#tts-help'), /use Steam Cloud instead/);
    await page.screenshot({ path: path.join(OUT, 'tts-help.png'), clip: await page.locator('#tts-load').boundingBox() });
    const names = Object.keys(tts.zip.files).filter((n) => !n.endsWith('/')).sort();
    console.log('TTS zip:', names);
    const fire = JSON.parse(await tts.zip.file('Card Builder/Fire Deck.json').async('string'));
    const deck = fire.ObjectStates[0];
    assert.equal(deck.Name, 'DeckCustom');
    assert.equal(deck.ContainedObjects.length, 11);
    const [sheet] = Object.values(deck.CustomDeck);
    assert.match(sheet.FaceURL, /^C:\\Users\\tester\\Documents\\My Games\\Tabletop Simulator\\Saves\\Saved Objects\\Card Builder\\images\\fire-deck-\d{8}-\d{6}-sheet1\.jpg$/);
    assert.equal(sheet.NumWidth, 2);
    assert.equal(sheet.NumHeight, 2);
    const faceName = 'Card Builder/images/' + sheet.FaceURL.split(/[\\/]/).pop();
    const face = await tts.zip.file(faceName).async('nodebuffer');
    assert.deepEqual(imageSize(face), { width: 2 * 744, height: 2 * 1039 });
    await writeFile(path.join(OUT, 'fire-sheet.jpg'), face);
    assert.ok(tts.zip.file('Card Builder/Water Deck.json'));
    assert.ok(tts.zip.file('Card Builder/Fire Deck.png'));
    assert.match(await tts.zip.file('Card Builder/HOW TO IMPORT.txt').async('string'), /Width: 2\s+Height: 2\s+Number: 4/);

    // Web-hosted mode + compatible sheets.
    await page.check('input[name="tts-mode"][value="web"]');
    assert.equal(await page.isDisabled('#export-tts'), true);
    await page.fill('#tts-url', 'https://example.com/decks');
    const webHelp = await page.innerText('#tts-load');
    assert.match(webHelp, /Upload the files inside Card Builder\/images to\s+https:\/\/example\.com\/decks/);
    assert.match(webHelp, /Everyone in your game sees the cards/);
    assert.doesNotMatch(webHelp, /Only you will see these cards/);
    await page.selectOption('#tts-quality', 'compatible');
    const web = await saveDownload(page, 'export-tts');
    const water = JSON.parse(await web.zip.file('Card Builder/Water Deck.json').async('string'));
    const waterSheet = Object.values(water.ObjectStates[0].CustomDeck)[0];
    assert.match(waterSheet.FaceURL, /^https:\/\/example\.com\/decks\/water-deck-\d{8}-\d{6}-sheet1\.jpg$/);
    assert.match(waterSheet.BackURL, /^https:\/\/example\.com\/decks\/water-deck-.*-back\.jpg$/);

    // Images zip: one PNG per unique card plus a back per deck.
    const images = await saveDownload(page, 'export-images');
    const pngs = Object.keys(images.zip.files).filter((n) => n.endsWith('.png')).sort();
    console.log('Images zip:', pngs);
    assert.equal(pngs.length, 10);
    assert.ok(pngs.includes('Fire Deck/01-ember-imp.png'));
    assert.deepEqual(imageSize(await images.zip.file('Fire Deck/01-ember-imp.png').async('nodebuffer')), { width: 744, height: 1039 });

    // Uploaded back replaces the generated one.
    await page.setInputFiles('#back-input', path.join(ROOT, 'examples/art/tide.jpg'));
    await page.waitForFunction(() => document.getElementById('back-status').textContent === 'tide.jpg');

    // Layout selector re-renders.
    await tab(page, 'cards');
    await page.selectOption('#layout-select', 'full-art');
    await page.waitForFunction(() => document.querySelectorAll('.tile canvas').length === 8);
    await page.screenshot({ path: path.join(OUT, 'preview-full-art.png'), fullPage: true });

    // Street example: graffiti layout; only Thugs have stats.
    await loadExample(page, 'street-cards.csv');
    await page.waitForFunction(() => document.querySelectorAll('.tile canvas').length === 5);
    assert.match(await page.textContent('#sheet-status'), /street-cards\.csv · 5 cards/);
    assert.equal(await page.isHidden('#warnings'), true, 'street example should load without warnings');
    await page.screenshot({ path: path.join(OUT, 'preview-street.png'), fullPage: true });
    // Street art has no art column: every image is matched by card name.
    for (const [index, name] of ['block-party-boss', 'corner-lookout', 'gold-chain', 'night-shift', 'mixtape-drop'].entries()) {
      const png = await page.evaluate((n) => document.querySelectorAll('.tile canvas')[n].toDataURL('image/png'), index);
      await writeFile(path.join(OUT, `street-${name}.png`), Buffer.from(png.split(',')[1], 'base64'));
    }
    await tab(page, 'tts');
    const streetTts = await saveDownload(page, 'export-tts');
    const street = JSON.parse(await streetTts.zip.file('Card Builder/Street Deck.json').async('string'));
    assert.equal(street.ObjectStates[0].ContainedObjects.length, 11);
    assert.match(street.ObjectStates[0].ContainedObjects[0].Description, /Cost: 5/);
    assert.match(street.ObjectStates[0].ContainedObjects[0].Description, /Strengf 4 · Helf 3 · Steal 2/);
    const goldChain = street.ObjectStates[0].ContainedObjects.find((c) => c.Nickname === 'Gold Chain');
    assert.match(goldChain.Description, /Equip cost 2/);

    // .xlsx files: inline strings (openpyxl) and shared strings (Excel).
    await page.setInputFiles('#sheet-input', path.join(ROOT, 'tests/fixtures/cards.xlsx'));
    await page.waitForFunction(() => /cards\.xlsx · 2 cards \(3 with copies\)/.test(document.getElementById('sheet-status').textContent));
    await page.setInputFiles('#sheet-input', path.join(ROOT, 'tests/fixtures/shared-strings.xlsx'));
    await page.waitForFunction(() => /shared-strings\.xlsx · 2 cards \(5 with copies\)/.test(document.getElementById('sheet-status').textContent));

    // Bad input surfaces warnings instead of failing.
    await page.setInputFiles('#sheet-input', { name: 'bad.csv', mimeType: 'text/csv', buffer: Buffer.from('name,layout,art\nOdd,nope,ghost.png\nLonely Card,,\n') });
    await page.waitForSelector('#warnings:not([hidden])');
    const warnings = await page.textContent('#warnings');
    assert.match(warnings, /unknown layout "nope"/);
    assert.match(warnings, /Missing art \(1\): ghost\.png/);
    assert.match(warnings, /No image found for 1 card: Lonely Card\. Name each image after its card/);
    assert.match(await page.textContent('#art-status'), /· 2 cards without art$/);
    // A header that means another column shows what it was read as.
    await page.setInputFiles('#sheet-input', { name: 'alias.csv', mimeType: 'text/csv', buffer: Buffer.from('Name,Effects\nZap,Deal 1.\n') });
    await tab(page, 'data');
    await page.waitForFunction(() => /alias\.csv/.test(document.getElementById('data-view').textContent));
    assert.equal(await page.textContent('table.data thead th:has-text("Effects") small'), 'text');

    // Steam Cloud: download the images to upload, paste links, download the deck.
    await loadExample(page, 'street-cards.csv');
    await page.waitForFunction(() => document.querySelectorAll('.tile canvas').length === 5);
    await tab(page, 'tts');
    await page.check('input[name="tts-mode"][value="cloud"]');
    await page.selectOption('#tts-quality', 'high');
    assert.equal(await page.isDisabled('#export-tts'), true);
    assert.match(await page.textContent('#tts-reason'), /Start with step 1: download the pictures to upload/);
    assert.match(await page.innerText('#tts-cloud'), /click Upload, then Cloud Manager/);
    assert.match(await page.innerText('#cloud-links'), /appear here after step 1/);
    const pack = await saveDownload(page, 'cloud-pack');
    const packFiles = Object.keys(pack.zip.files).filter((n) => !n.endsWith('/')).sort();
    console.log('Steam Cloud upload zip:', packFiles);
    assert.equal(packFiles.length, 2);
    assert.ok(packFiles.every((n) => /^Card Builder uploads\/(street-deck-sheet1|back)-[0-9a-f]{10}\.jpg$/.test(n)));
    const rows = await page.$$eval('.cloud-row', (els) => els.map((el) => el.querySelector('code').textContent));
    assert.deepEqual(rows.sort(), packFiles.map((n) => n.split('/').pop()).sort());
    assert.match(await page.textContent('#tts-reason'), /Step 3: paste the Steam Cloud link for 2 more pictures/);
    const links = {};
    for (const [i, name] of rows.entries()) {
      links[name] = `https://steamusercontent-a.akamaihd.net/ugc/${1000 + i}/HASH${i}/`;
      await page.fill(`.cloud-row:has(code:text-is("${name}")) input`, links[name]);
    }
    assert.equal(await page.isDisabled('#export-tts'), false);
    const cloudTts = await saveDownload(page, 'export-tts');
    const cloudNames = Object.keys(cloudTts.zip.files);
    assert.ok(!cloudNames.some((n) => n.includes('/images/')), 'Steam Cloud decks ship no image files');
    const cloudDeck = JSON.parse(await cloudTts.zip.file('Card Builder/Street Deck.json').async('string')).ObjectStates[0];
    const [cloudSheet] = Object.values(cloudDeck.CustomDeck);
    assert.equal(cloudSheet.FaceURL, links[rows.find((n) => n.startsWith('street-deck-sheet1'))]);
    assert.equal(cloudSheet.BackURL, links[rows.find((n) => n.startsWith('back-'))]);
    assert.equal(cloudDeck.ContainedObjects.length, 11);
    assert.match(await cloudTts.zip.file('Card Builder/HOW TO IMPORT.txt').async('string'), /load from your Steam Cloud/);

    // After a reload, unchanged images get their links back without re-uploading.
    await page.reload();
    await page.waitForSelector('body[data-ready="true"]');
    await page.click('.empty [data-example="street-cards.csv"]');
    await page.waitForFunction(() => document.querySelectorAll('.tile canvas').length === 5);
    assert.equal(await page.isChecked('input[name="tts-mode"][value="cloud"]'), true);
    // The uploaded back from earlier was lost in the reload; add it again so the images match.
    await page.setInputFiles('#back-input', path.join(ROOT, 'examples/art/tide.jpg'));
    await page.waitForFunction(() => document.getElementById('back-status').textContent === 'tide.jpg');
    await page.waitForFunction(() => document.querySelectorAll('.tile canvas').length === 5);
    await tab(page, 'tts');
    await saveDownload(page, 'cloud-pack');
    assert.match(await page.textContent('#status'), /All links are already filled in/);
    assert.equal(await page.isDisabled('#export-tts'), false);

    // Changing the sheet resolution makes new images, so the links go stale.
    await page.selectOption('#tts-quality', 'compatible');
    assert.equal(await page.isDisabled('#export-tts'), true);
    assert.match(await page.textContent('#tts-reason'), /Your cards changed/);
    await page.screenshot({ path: path.join(OUT, 'steam-cloud.png'), fullPage: true });
    await page.selectOption('#tts-quality', 'high');

    // Blank CSV templates: one per layout, in the Templates & examples tab.
    await tab(page, 'start');
    await page.screenshot({ path: path.join(OUT, 'templates.png'), fullPage: true });
    const [templateDownload] = await Promise.all([page.waitForEvent('download'), page.click('[data-template="street"]')]);
    assert.equal(templateDownload.suggestedFilename(), 'street-template.csv');
    const templateFile = path.join(OUT, 'street-template.csv');
    await templateDownload.saveAs(templateFile);
    assert.equal(await readFile(templateFile, 'utf8'), 'name,count,deck,cost,text,flavor,type,tags (separate with commas),strengf,helf,steal,equip_cost\r\n');

    // FlagonQuest: the real techniques spreadsheet layout, picked automatically.
    await page.selectOption('#layout-select', 'default');
    await page.setInputFiles('#sheet-input', path.join(ROOT, 'examples/flagonquest-techniques.csv'));
    await page.waitForFunction(() => /flagonquest-techniques\.csv · 9 cards/.test(document.getElementById('sheet-status').textContent));
    await page.waitForFunction(() => document.querySelectorAll('.tile canvas').length === 9);
    assert.equal(await page.inputValue('#layout-select'), 'flagonquest');
    assert.match(await page.textContent('#status'), /Switched to the FlagonQuest layout/);
    assert.equal(await page.isHidden('#warnings'), true, 'FlagonQuest example should load without warnings');
    await page.screenshot({ path: path.join(OUT, 'preview-flagonquest.png'), fullPage: true });
    for (const [index, name] of ['brace', 'battle-maneuver', 'lay-on-hands', 'boulder-toss', 'profession'].entries()) {
      const at = [0, 1, 3, 4, 8][index];
      const png = await page.evaluate((n) => document.querySelectorAll('.tile canvas')[n].toDataURL('image/png'), at);
      await writeFile(path.join(OUT, `fq-${name}.png`), Buffer.from(png.split(',')[1], 'base64'));
    }
    await tab(page, 'tts');
    await page.check('input[name="tts-mode"][value="local"]');
    const fqTts = await saveDownload(page, 'export-tts');
    const fqDeck = JSON.parse(await fqTts.zip.file('Card Builder/Deck.json').async('string')).ObjectStates[0];
    const brace = fqDeck.ContainedObjects.find((c) => c.Nickname === 'Brace');
    assert.equal(brace.Description, '[b]Tags:[/b] Encounter\n[b]Action:[/b] 1 AP\n[b]Skills:[/b] Resilience\nYou gain 3 stacks of Protected.\n[b]Prereqs:[/b] Resilience 2\n[i]You draw a deep breath, steeling yourself for the struggle ahead.[/i]');

    // FlagonQuest items: the real items spreadsheet, its layout picked automatically.
    await page.setInputFiles('#sheet-input', path.join(ROOT, 'examples/flagonquest-items.csv'));
    await page.waitForFunction(() => /flagonquest-items\.csv · 9 cards/.test(document.getElementById('sheet-status').textContent));
    await page.waitForFunction(() => document.querySelectorAll('.tile canvas').length === 9);
    assert.equal(await page.inputValue('#layout-select'), 'flagonquest');
    assert.equal(await page.isHidden('#warnings'), true, 'FlagonQuest items example should load without warnings');
    for (let i = 0; i < 9; i++) {
      const png = await page.evaluate((n) => document.querySelectorAll('.tile canvas')[n].toDataURL('image/png'), i);
      await writeFile(path.join(OUT, `fq-item-${i}.png`), Buffer.from(png.split(',')[1], 'base64'));
    }
    await tab(page, 'tts');
    const itemTts = await saveDownload(page, 'export-tts');
    const items = JSON.parse(await itemTts.zip.file('Card Builder/Deck.json').async('string')).ObjectStates[0].ContainedObjects;
    const armor = items.find((c) => c.Nickname === 'Medium Armor');
    assert.match(armor.Description, /\[b\]Physical Resist:\[\/b\] 2/);
    assert.match(armor.Description, /\[b\]Might Req:\[\/b\] 5/);

    // Allies: the background blends the Aura colors; Inverted darkens its share.
    await loadExample(page, 'allies.csv');
    await page.waitForFunction(() => document.querySelectorAll('.tile canvas').length === 6);
    assert.equal(await page.inputValue('#layout-select'), 'allies');
    assert.equal(await page.isHidden('#warnings'), true, 'allies example should load without warnings');
    for (let i = 0; i < 6; i++) {
      const png = await page.evaluate((n) => document.querySelectorAll('.tile canvas')[n].toDataURL('image/png'), i);
      await writeFile(path.join(OUT, `allies-${i}.png`), Buffer.from(png.split(',')[1], 'base64'));
    }
    // Average color of a strip along the card's left edge.
    const edge = (i) => page.evaluate((n) => {
      const d = document.querySelectorAll('.tile canvas')[n].getContext('2d').getImageData(4, 300, 4, 300).data;
      const sum = [0, 0, 0];
      for (let k = 0; k < d.length; k += 4) for (let c = 0; c < 3; c++) sum[c] += d[k + c];
      return sum.map((v) => v / (d.length / 4));
    }, i);
    // Pure Instinct is green; Inverted Knowledge is still bluish, but blighted (dark and dull).
    const [r0, g0, b0] = await edge(0);
    assert.ok(g0 > r0 + 40 && g0 > b0 + 40, `green edge ${[r0, g0, b0]}`);
    const [r3, g3, b3] = await edge(3);
    assert.ok(b3 >= r3 && b3 >= g3 && r3 + g3 + b3 < 260, `blighted blue edge ${[r3, g3, b3]}`);

    // Cards sent in the link (FlagonQuest's Character Sheet): picked layout, decks and counts.
    const sent = await encodeHandoff({
      title: 'Aria',
      layout: 'flagonquest',
      columns: ['name', 'count', 'deck', 'level_min', 'level_max', 'tags', 'action', 'text', 'built_features', 'picks', 'category', 'slot', 'physical_resist', 'powers'],
      rows: [
        ['Shield Bash', 2, 'Aria: Techniques', 2, 2, 'Martial, Buildable, Encounter', '2 AP', 'Make a weapon attack.',
          '**Lunging ×2** — Up to 2 times, you may Shift up to 2 meters in a single direction, each either before or after the attack.\n**Wind Slash** — For the attack the chosen weapon\'s range is increased by 2.', '', '', '', '', ''],
        ['Artisanal Training', 1, 'Aria: Techniques', 1, 1, 'Duplicate', 'Passive', 'You have Good Luck on crafting flips for the chosen School.', '', '**School:** Smithing', '', '', '', ''],
        ['Grandpa\'s Coat', 1, 'Aria: Items', '', '', '', '', 'Smells of pipe smoke.', '', '', 'Custom', 'Torso', 1,
          '**Cowl of Tranquility** (Lv 2)\nYou cannot gain stacks of Taunted or Frightened.'],
      ],
    });
    await page.goto(base + sent);
    await page.waitForSelector('body[data-ready="true"]');
    await page.waitForFunction(() => document.querySelectorAll('.tile canvas').length === 3);
    assert.equal(await page.inputValue('#layout-select'), 'flagonquest');
    assert.equal(await page.textContent('#sheet-status'), 'Aria · 3 cards (4 with copies)');
    assert.match(await page.textContent('#status'), /Loaded 3 cards for Aria/);
    assert.deepEqual(await page.$$eval('.deck h2 > span:first-child', (els) => els.map((e) => e.textContent)), ['Aria: Techniques', 'Aria: Items']);
    assert.equal(await page.isHidden('#warnings'), true, 'sent cards should load without warnings');
    await page.screenshot({ path: path.join(OUT, 'preview-sent.png'), fullPage: true });
    for (const [i, name] of ['shield-bash', 'artisanal-training', 'custom-coat'].entries()) {
      const png = await page.evaluate((n) => document.querySelectorAll('.tile canvas')[n].toDataURL('image/png'), i);
      await writeFile(path.join(OUT, `sent-${name}.png`), Buffer.from(png.split(',')[1], 'base64'));
    }
    // Sending again reuses the tab: only the "#" part changes.
    const again = await encodeHandoff({ title: 'Brom', layout: 'flagonquest', columns: ['name', 'level_min', 'text'], rows: [['Brace', 1, 'You gain 3 stacks of Protected.']] });
    await page.evaluate((h) => (location.hash = h), again);
    await page.waitForFunction(() => document.querySelectorAll('.tile canvas').length === 1);
    assert.equal(await page.textContent('#sheet-status'), 'Brom · 1 card (1 with copies)');
    // A damaged link shows a warning instead of failing.
    await page.evaluate(() => (location.hash = '#import=garbage'));
    await page.waitForSelector('#warnings:not([hidden])');
    assert.match(await page.textContent('#warnings'), /damaged or incomplete/);
    errors.splice(0, errors.length, ...errors.filter((e) => !/damaged|DecompressionStream|incorrect header|invalid/i.test(e)));

    assert.deepEqual(errors, [], 'no console errors');
    console.log('\nAll end-to-end checks passed.');
  } finally {
    await browser.close();
    server.close();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
