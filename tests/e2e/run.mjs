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

    // Steam Cloud is the default; "This computer" needs a folder first.
    assert.equal(await page.isChecked('input[name="tts-mode"][value="cloud"]'), true);
    await page.check('input[name="tts-mode"][value="local"]');
    assert.equal(await page.isDisabled('#export-tts'), true);
    await page.fill('#tts-folder', 'C:\\Users\\tester\\Documents\\My Games\\Tabletop Simulator\\Saves\\Saved Objects');
    assert.equal(await page.isDisabled('#export-tts'), false);

    assert.equal(await page.evaluate(() => document.getElementById('tts-help').open), false);
    const tts = await saveDownload(page, 'export-tts');

    // The TTS help opens after the download, with this computer's steps and folder filled in.
    assert.equal(await page.evaluate(() => document.getElementById('tts-help').open), true);
    const localHelp = await page.innerText('#tts-help');
    assert.match(localHelp, /Move the Card Builder folder into your Saved Objects folder:\s+C:\\Users\\tester\\Documents/);
    assert.match(localHelp, /Only you will see these cards/);
    assert.doesNotMatch(localHelp, /Upload the files inside images/);
    await page.screenshot({ path: path.join(OUT, 'tts-help.png'), clip: await page.locator('#tts-help').boundingBox() });
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
    const webHelp = await page.innerText('#tts-help');
    assert.match(webHelp, /Upload the files inside images to\s+https:\/\/example\.com\/decks/);
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
    const goldChain = street.ObjectStates[0].ContainedObjects.find((c) => c.Nickname === 'Gold Chain');
    assert.match(goldChain.Description, /Equip cost 2/);

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

    // Steam Cloud: download the images to upload, paste links, download the deck.
    await page.click('[data-example="street-cards.csv"] >> nth=0');
    await page.waitForFunction(() => document.querySelectorAll('.tile canvas').length === 5);
    await page.check('input[name="tts-mode"][value="cloud"]');
    await page.selectOption('#tts-quality', 'high');
    assert.equal(await page.isDisabled('#export-tts'), true);
    assert.match(await page.textContent('#tts-reason'), /Step 1: download the images to upload/);
    const pack = await saveDownload(page, 'cloud-pack');
    const packFiles = Object.keys(pack.zip.files).filter((n) => !n.endsWith('/')).sort();
    console.log('Steam Cloud upload zip:', packFiles);
    assert.equal(packFiles.length, 2);
    assert.ok(packFiles.every((n) => /^Card Builder uploads\/(street-deck-sheet1|back)-[0-9a-f]{10}\.jpg$/.test(n)));
    const rows = await page.$$eval('.cloud-row', (els) => els.map((el) => el.querySelector('code').textContent));
    assert.deepEqual(rows.sort(), packFiles.map((n) => n.split('/').pop()).sort());
    assert.match(await page.textContent('#tts-reason'), /Paste the Steam Cloud link for 2 more images/);
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
    await page.click('[data-example="street-cards.csv"] >> nth=0');
    await page.waitForFunction(() => document.querySelectorAll('.tile canvas').length === 5);
    assert.equal(await page.isChecked('input[name="tts-mode"][value="cloud"]'), true);
    // The uploaded back from earlier was lost in the reload; add it again so the images match.
    await page.setInputFiles('#back-input', path.join(ROOT, 'examples/art/tide.jpg'));
    await page.waitForFunction(() => document.getElementById('back-status').textContent === 'tide.jpg');
    await page.waitForFunction(() => document.querySelectorAll('.tile canvas').length === 5);
    await saveDownload(page, 'cloud-pack');
    assert.match(await page.textContent('#status'), /All links are already filled in/);
    assert.equal(await page.isDisabled('#export-tts'), false);

    // Changing the sheet resolution makes new images, so the links go stale.
    await page.selectOption('#tts-quality', 'compatible');
    assert.equal(await page.isDisabled('#export-tts'), true);
    assert.match(await page.textContent('#tts-reason'), /Your cards changed/);
    await page.screenshot({ path: path.join(OUT, 'steam-cloud.png'), fullPage: true });
    await page.selectOption('#tts-quality', 'high');

    // Blank CSV template follows the selected layout.
    await page.selectOption('#layout-select', 'street');
    assert.equal(await page.textContent('#download-template'), 'Download a blank Street template (.csv)');
    const [templateDownload] = await Promise.all([page.waitForEvent('download'), page.click('#download-template')]);
    assert.equal(templateDownload.suggestedFilename(), 'street-template.csv');
    const templateFile = path.join(OUT, 'street-template.csv');
    await templateDownload.saveAs(templateFile);
    assert.equal(await readFile(templateFile, 'utf8'), 'name,count,deck,cost,text,flavor,type,tags (separate with commas),strengf,helf,steal,equip_cost\r\n');

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
