// End-to-end check in a real browser: loads the example deck, exports both
// zips, and inspects what's inside. Screenshots and downloads land in test-output/.
// Run: npm run test:e2e
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

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
    await page.click('[data-example="example-cards.csv"] >> nth=0');
    await page.waitForFunction(() => document.querySelectorAll('.tile canvas').length === 8);
    assert.match(await page.textContent('#sheet-status'), /8 cards \(22 with copies\)/);
    assert.match(await page.textContent('#art-status'), /6 images/);
    assert.equal(await page.isHidden('#warnings'), true, 'example should load without warnings');
    await page.screenshot({ path: path.join(OUT, 'preview.png'), fullPage: true });

    // Lightbox
    await page.click('.tile >> nth=0');
    await page.screenshot({ path: path.join(OUT, 'lightbox.png') });
    await page.click('#lightbox');

    // TTS export needs a folder first.
    assert.equal(await page.isDisabled('#export-tts'), true);
    await page.fill('#tts-folder', 'C:\\Users\\tester\\Documents\\My Games\\Tabletop Simulator\\Saves\\Saved Objects');
    assert.equal(await page.isDisabled('#export-tts'), false);

    const tts = await saveDownload(page, 'export-tts');
    const names = Object.keys(tts.zip.files).filter((n) => !n.endsWith('/')).sort();
    console.log('TTS zip:', names);
    const fire = JSON.parse(await tts.zip.file('Card Builder/Fire Deck.json').async('string'));
    const deck = fire.ObjectStates[0];
    assert.equal(deck.Name, 'DeckCustom');
    assert.equal(deck.ContainedObjects.length, 11);
    const [sheet] = Object.values(deck.CustomDeck);
    assert.match(sheet.FaceURL, /^file:\/\/\/C:\/Users\/tester\/Documents\/My Games\/Tabletop Simulator\/Saves\/Saved Objects\/Card Builder\/images\/fire-deck-\d{8}-\d{6}-sheet1\.jpg$/);
    assert.equal(sheet.NumWidth, 2);
    assert.equal(sheet.NumHeight, 2);
    const faceName = 'Card Builder/images/' + sheet.FaceURL.split('/').pop();
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
    await page.selectOption('#layout-select', 'full-art');
    await page.waitForFunction(() => document.querySelectorAll('.tile canvas').length === 8);
    await page.screenshot({ path: path.join(OUT, 'preview-full-art.png'), fullPage: true });

    // Street example: graffiti layout; only Thugs have stats.
    await page.click('[data-example="street-cards.csv"] >> nth=0');
    await page.waitForFunction(() => document.querySelectorAll('.tile canvas').length === 5);
    assert.match(await page.textContent('#sheet-status'), /street-cards\.csv: 5 cards/);
    assert.equal(await page.isHidden('#warnings'), true, 'street example should load without warnings');
    await page.screenshot({ path: path.join(OUT, 'preview-street.png'), fullPage: true });
    // Street art has no art column: every image is matched by card name.
    for (const [index, name] of ['block-party-boss', 'corner-lookout', 'gold-chain', 'night-shift', 'mixtape-drop'].entries()) {
      const png = await page.evaluate((n) => document.querySelectorAll('.tile canvas')[n].toDataURL('image/png'), index);
      await writeFile(path.join(OUT, `street-${name}.png`), Buffer.from(png.split(',')[1], 'base64'));
    }
    const streetTts = await saveDownload(page, 'export-tts');
    const street = JSON.parse(await streetTts.zip.file('Card Builder/Street Deck.json').async('string'));
    assert.equal(street.ObjectStates[0].ContainedObjects.length, 11);
    assert.match(street.ObjectStates[0].ContainedObjects[0].Description, /Cost: 5/);
    assert.match(street.ObjectStates[0].ContainedObjects[0].Description, /Strengf 4 · Helf 3 · Steal 2/);

    // .xlsx files: inline strings (openpyxl) and shared strings (Excel).
    await page.setInputFiles('#sheet-input', path.join(ROOT, 'tests/fixtures/cards.xlsx'));
    await page.waitForFunction(() => /cards\.xlsx: 2 cards \(3 with copies\)/.test(document.getElementById('sheet-status').textContent));
    await page.setInputFiles('#sheet-input', path.join(ROOT, 'tests/fixtures/shared-strings.xlsx'));
    await page.waitForFunction(() => /shared-strings\.xlsx: 2 cards \(5 with copies\)/.test(document.getElementById('sheet-status').textContent));

    // Bad input surfaces warnings instead of failing.
    await page.setInputFiles('#sheet-input', { name: 'bad.csv', mimeType: 'text/csv', buffer: Buffer.from('name,layout,art\nOdd,nope,ghost.png\nLonely Card,,\n') });
    await page.waitForSelector('#warnings:not([hidden])');
    const warnings = await page.textContent('#warnings');
    assert.match(warnings, /unknown layout "nope"/);
    assert.match(warnings, /Missing art \(1\): ghost\.png/);
    assert.match(warnings, /No image found for 1 card: Lonely Card\. Name each image after its card/);

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
