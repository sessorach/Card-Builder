// Page wiring: inputs → state → preview → exports.
import { parseDelimited, detectDelimiter, rowsToCards, groupByDeck } from './spreadsheet.js';
import { readXlsx } from './xlsx.js';
import { LAYOUTS, getLayout, matchesColumns } from '../layouts/index.js';
import { CARD_SIZES, DEFAULT_SIZE_ID, getSize, sizePx } from './sizes.js';
import { AssetStore, decodeImage, renderCard, renderBack, findArt, cardAccent } from './render.js';
import { loadFonts } from './fonts.js';
import { unknownBlendItems, BLEND_STYLES } from './blend.js';
import { buildImagesZip, buildTtsZip, prepareTtsImages, cloudFiles, buildUploadZip } from './export.js';
import { templateCsv, templateColumns } from './template.js';
import { columnHelp } from './columns.js';
import { handoffData, decodeHandoff } from './handoff.js';
import { cleanInput, savedObjectsFolder, localImagesFolder, isLink, looksLikeSteamCloud, cardDescription } from './tts.js';

const $ = (id) => document.getElementById(id);
const ART_HINT = 'Images named after their cards';
const BACK_HINT = 'Generated · drop an image to replace it';
const IMAGE_EXT = /\.(png|jpe?g|webp|gif|bmp|avif)$/i;
const SHEET_EXT = /\.(csv|tsv|txt|xlsx)$/i;

const state = {
  sheetName: '',
  example: '', // the example spreadsheet on show, if the cards are an example
  exampleArt: false, // every loaded image came with an example (so switching examples can drop them)
  cards: [],
  columns: [], // normalized column names, as rowsToCards returns them
  headers: [], // the same columns as written in the spreadsheet
  sheetWarnings: [],
  assets: new AssetStore(),
  back: null, // uploaded back image (ImageBitmap) or null
  backName: '',
  canvases: new Map(), // card.id → rendered canvas
  backs: new Map(), // deck name → rendered back canvas
  busy: false,
  // Steam Cloud: the images last downloaded for upload, and which render they came from.
  cloudPack: null, // { token, quality, prepared, files }
};

// ---- Settings (remembered per browser) --------------------------------------

const SETTINGS_KEY = 'card-builder:settings';
function loadSettings() {
  try {
    return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {};
  } catch {
    return {};
  }
}
const settings = {
  layout: 'default',
  size: DEFAULT_SIZE_ID,
  ttsMode: 'cloud',
  savedObjects: '',
  baseUrl: '',
  quality: 'high',
  ...loadSettings(),
};
// Steam Cloud links pasted so far, by image content hash. Kept across visits, so
// an image that hasn't changed never needs uploading or pasting again.
const LINKS_KEY = 'card-builder:cloud-links';
const cloudLinks = (() => {
  try {
    return JSON.parse(localStorage.getItem(LINKS_KEY)) || {};
  } catch {
    return {};
  }
})();
function saveCloudLinks() {
  try {
    localStorage.setItem(LINKS_KEY, JSON.stringify(cloudLinks));
  } catch {
    /* links just won't be remembered */
  }
}

function saveSettings() {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    /* private mode etc.: settings just won't persist */
  }
}

// ---- Helpers ----------------------------------------------------------------

const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));
const norm = (s) => String(s || '').trim().toLowerCase().replace(/[\s_]+/g, '-');

function resolveLayout(card) {
  if (card.layout) {
    const want = norm(card.layout);
    const found = getLayout(want) || LAYOUTS.find((l) => norm(l.name) === want);
    if (found) return { layout: found };
    return { layout: getLayout(settings.layout) || LAYOUTS[0], unknown: card.layout };
  }
  return { layout: getLayout(settings.layout) || LAYOUTS[0] };
}

function setStatus(text) {
  document.querySelectorAll('[data-status]').forEach((el) => (el.textContent = text));
}

// ---- Tabs ---------------------------------------------------------------------------

const currentTab = () => document.querySelector('.main').dataset.tab;
function showTab(name) {
  document.querySelector('.main').dataset.tab = name;
  document.querySelectorAll('[role="tab"]').forEach((tab) => tab.setAttribute('aria-selected', String(tab.dataset.tab === name)));
  document.querySelectorAll('.tab-panel').forEach((panel) => (panel.hidden = panel.dataset.panel !== name));
}

function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

const decks = () => groupByDeck(state.cards);
const cardPx = () => sizePx(getSize(settings.size));

// ---- Loading inputs -----------------------------------------------------------

async function loadSpreadsheet(file, options = {}) {
  try {
    let rows;
    if (/\.xlsx$/i.test(file.name)) {
      rows = await readXlsx(await file.arrayBuffer());
    } else if (/\.xls$/i.test(file.name)) {
      throw new Error('Old .xls files aren\'t supported. Save as .xlsx or .csv.');
    } else {
      const text = await file.text();
      rows = parseDelimited(text, detectDelimiter(text, file.name));
    }
    await applyRows(rows, file.name, options);
  } catch (err) {
    console.error(err);
    state.sheetWarnings = [`Couldn't read ${file.name}: ${err.message}`];
    renderWarnings();
  }
}

// Shows a spreadsheet's rows (header row first) as cards. `name` labels them in the page.
async function applyRows(rows, name, { layoutChosen = false, example = '' } = {}) {
  const { cards, warnings, columns, headers } = rowsToCards(rows);
  // A spreadsheet that fits a layout's known columns (e.g. FlagonQuest's techniques
  // sheet) picks that layout, unless it chooses layouts itself with a layout column.
  if (!columns.includes('layout') && !layoutChosen) {
    const match = LAYOUTS.find((l) => matchesColumns(l, columns));
    if (match && match.id !== settings.layout) {
      setLayout(match.id);
      setStatus(`Switched to the ${match.name} layout to match this spreadsheet.`);
    }
  }
  state.sheetName = name;
  state.example = example;
  state.cards = cards;
  state.columns = columns;
  state.headers = headers;
  state.sheetWarnings = warnings;
  document.querySelector('[data-drop="sheet"]').classList.toggle('loaded', cards.length > 0);
  const total = cards.reduce((n, c) => n + c.count, 0);
  $('sheet-status').textContent = `${name} · ${cards.length} card${cards.length === 1 ? '' : 's'} (${total} with copies)`;
  if (currentTab() !== 'data') showTab('cards');
  await rerender();
}

// Cards sent from another site in the link (see js/handoff.js), e.g. FlagonQuest's Character Sheet.
async function loadHandoff() {
  const data = handoffData(location.hash);
  if (!data) return;
  try {
    const { title, layout, rows } = await decodeHandoff(data);
    const chosen = getLayout(layout);
    if (chosen) setLayout(chosen.id);
    await applyRows(rows, title || 'Sent cards', { layoutChosen: !!chosen });
    setStatus(`Loaded ${state.cards.length} cards${title ? ` for ${title}` : ''}.`);
  } catch (err) {
    console.error(err);
    state.sheetWarnings = [err.message];
    renderWarnings();
  }
}

async function addArt(files, { render = true, fromExample = false } = {}) {
  const images = files.filter((f) => IMAGE_EXT.test(f.name));
  if (!images.length) return;
  state.exampleArt = fromExample && (state.exampleArt || !state.assets.size);
  setStatus(`Loading ${images.length} images…`);
  const failed = [];
  await Promise.all(
    images.map(async (f) => {
      try {
        state.assets.add(f.name, await decodeImage(f));
      } catch {
        failed.push(f.name);
      }
    }),
  );
  if (failed.length) state.sheetWarnings.push(`Couldn't open: ${failed.join(', ')}`);
  document.querySelector('[data-drop="art"]').classList.add('loaded');
  $('clear-art').hidden = false;
  setStatus('');
  if (render) await rerender();
}

async function setBack(file) {
  try {
    state.back = file ? await decodeImage(file) : null;
    state.backName = file ? file.name : '';
  } catch {
    state.back = null;
    state.backName = '';
    state.sheetWarnings.push(`Couldn't open back image ${file.name}.`);
  }
  document.querySelector('[data-drop="back"]').classList.toggle('loaded', !!state.back);
  $('clear-back').hidden = !state.back;
  $('back-status').textContent = state.back ? state.backName : BACK_HINT;
  await rerender();
}

// examples/manifest.json: per example spreadsheet, its title, description, the looks it
// shows (`for`), its pictures and the layout to pick.
let manifestPromise = null;
const getManifest = () => (manifestPromise ||= fetch('examples/manifest.json').then((r) => r.json()));
// The example spreadsheets for a look, in manifest order (the first is its main one).
const examplesFor = (manifest, layoutId) => Object.keys(manifest).filter((f) => (manifest[f].for || []).includes(layoutId));

// Loads an example spreadsheet and its pictures. `layout` keeps the look the user
// picked when the example serves several (Default, Full Art and Text Only share one).
async function loadExample(file, { layout } = {}) {
  showTab('cards');
  try {
    const manifest = await getManifest();
    const entry = manifest[file] || {};
    const text = await (await fetch(`examples/${file}`)).text();
    setLayout(layout && (entry.for || []).includes(layout) ? layout : entry.layout || layout || settings.layout);
    // Another example's pictures go; pictures you dropped in stay.
    if (state.exampleArt) state.assets = new AssetStore();
    await addArt(await exampleArt(entry), { render: false, fromExample: true });
    await loadSpreadsheet(new File([text], file, { type: 'text/csv' }), { layoutChosen: true, example: file });
  } catch (err) {
    console.error(err);
    setStatus(`Couldn't load the example: ${err.message}`);
  }
}

const artCache = new Map();
function exampleArt(entry) {
  return Promise.all(
    (entry.images || []).map((name) => {
      if (!artCache.has(name)) {
        artCache.set(name, fetch(`examples/art/${encodeURIComponent(name)}`).then(async (res) => (res.ok ? new File([await res.blob()], name) : null)));
      }
      return artCache.get(name);
    }),
  ).then((files) => files.filter(Boolean));
}

// Picking a look while an example (or nothing) is on show shows that look's example,
// so switching looks is a way to browse them. Your own cards just redraw.
async function changeLook(id) {
  setLayout(id);
  if (!state.cards.length || state.example) {
    const [main] = examplesFor(await getManifest(), id);
    if (main && main !== state.example) return loadExample(main, { layout: id });
  }
  await rerender();
}

// ---- Rendering ------------------------------------------------------------------

function deckColor(deck) {
  for (const card of deck.cards) {
    const accent = cardAccent(card, resolveLayout(card).layout);
    if (accent) return accent;
  }
  return undefined;
}

function getBack(deck) {
  if (!state.backs.has(deck.name)) {
    state.backs.set(deck.name, renderBack({ image: state.back, px: cardPx(), title: deck.name, color: deckColor(deck) }));
  }
  return state.backs.get(deck.name);
}

function renderWarnings(extra = []) {
  const all = [...state.sheetWarnings, ...extra];
  const box = $('warnings');
  box.hidden = !all.length;
  box.replaceChildren();
  if (!all.length) return;
  const details = document.createElement('details');
  details.open = all.length <= 6;
  const summary = document.createElement('summary');
  summary.textContent = `${all.length} thing${all.length === 1 ? '' : 's'} to check`;
  const list = document.createElement('ul');
  for (const w of all) {
    const li = document.createElement('li');
    li.textContent = w;
    list.append(li);
  }
  details.append(summary, list);
  box.append(details);
}

// The empty page (the looks to pick from), kept to show again if the cards go away.
const EMPTY = document.querySelector('#decks .empty');

// Over example cards: what they are and where to go next.
function exampleNote() {
  const layout = getLayout(settings.layout) || LAYOUTS[0];
  const note = document.createElement('div');
  note.className = 'example-note';
  note.innerHTML = '<p><b>Example cards in the <span></span> look.</b> Try other looks with the <b>Look</b> picker on the left. When you find one you like, get its spreadsheet and instructions under <button type="button" class="link" data-tab-link="start">Template &amp; guide</button>.</p>';
  note.querySelector('span').textContent = layout.name;
  note.querySelector('button').addEventListener('click', () => showTab('start'));
  return note;
}

let renderToken = 0;
async function rerender() {
  const token = ++renderToken;
  state.canvases.clear();
  state.backs.clear();
  drawBackPreview();
  updateExportButtons();

  const container = $('decks');
  renderArtStatus();
  renderData();
  $('card-count').textContent = state.cards.length || '';
  if (!state.cards.length) {
    container.replaceChildren(EMPTY);
    renderWarnings();
    return;
  }
  container.replaceChildren();
  if (state.example) container.append(exampleNote());
  const px = cardPx();
  const extra = [];
  const missingArt = new Set(); // art-column files that weren't uploaded
  const unmatched = []; // cards with no art column and no image named after them

  for (const deck of decks()) {
    const section = document.createElement('section');
    section.className = 'deck';
    const h = document.createElement('h2');
    const total = deck.cards.reduce((n, c) => n + c.count, 0);
    h.innerHTML = `<span></span><small>${total} cards · ${deck.cards.length} unique</small>`;
    h.firstChild.textContent = deck.name;
    const grid = document.createElement('div');
    grid.className = 'grid';
    section.append(h, grid);
    container.append(section);

    for (const [i, card] of deck.cards.entries()) {
      const { layout, unknown } = resolveLayout(card);
      if (unknown) extra.push(`Row ${card.row}: unknown layout "${unknown}"; using ${layout.name}.`);
      extra.push(...blendWarnings(card, layout));
      if (needsArt(card) && !findArt(card, state.assets)) {
        if (card.art) missingArt.add(card.art);
        else if (state.assets.size) unmatched.push(card.name);
      }
      const canvas = renderCard(card, { layout, px, assets: state.assets });
      state.canvases.set(card.id, canvas);

      const fig = document.createElement('figure');
      fig.className = 'tile';
      fig.title = `Row ${card.row} · ${layout.name}`;
      const cap = document.createElement('figcaption');
      const name = document.createElement('span');
      name.textContent = card.name;
      cap.append(name);
      if (card.count > 1) {
        const copies = document.createElement('span');
        copies.className = 'copies';
        copies.textContent = `×${card.count}`;
        cap.append(copies);
      }
      fig.append(canvas, cap);
      fig.addEventListener('click', () => openLightbox(canvas));
      grid.append(fig);

      if (i % 6 === 5) {
        await nextFrame();
        if (token !== renderToken) return; // a newer render started
      }
    }
  }

  if (missingArt.size) {
    const names = [...missingArt];
    extra.push(
      `Missing art (${names.length}): ${names.slice(0, 12).join(', ')}${names.length > 12 ? ', …' : ''}. Drop in the images named in the art column.`,
    );
  }
  if (unmatched.length) {
    extra.push(
      `No image found for ${unmatched.length} card${unmatched.length === 1 ? '' : 's'}: ${unmatched.slice(0, 12).join(', ')}${unmatched.length > 12 ? ', …' : ''}. Name each image after its card, e.g. "${unmatched[0]}.png".`,
    );
  }
  renderWarnings(extra);
  updateExportButtons();
}

// A blend background's list (e.g. RossQuest's aura) with words it doesn't know, or a
// blend style that doesn't exist: say which, rather than quietly leaving a color out.
function blendWarnings(card, layout) {
  const out = [];
  for (const el of layout.elements) {
    if (el.type !== 'blend') continue;
    const value = card.fields[el.field] ?? '';
    const bad = unknownBlendItems(value, el.colors || {});
    if (bad.length) {
      const known = Object.keys(el.colors || {}).map((k) => k[0].toUpperCase() + k.slice(1));
      out.push(`Row ${card.row} (${card.name}): "${bad.join('", "')}" in ${el.field} isn't one of ${known.join(', ')}, so it was left out of the colors.`);
    }
    const style = String(card.fields[el.styleField] ?? '').trim();
    if (el.styleField && style && !BLEND_STYLES.includes(style.toLowerCase().replace(/\s+/g, '-'))) {
      out.push(`Row ${card.row} (${card.name}): ${el.styleField} "${style}" isn't a style; use ${BLEND_STYLES.join(', ')}. Using ${el.style || 'gradient'}.`);
    }
  }
  return out;
}

const needsArt = (card) => resolveLayout(card).layout.elements.some((e) => e.type === 'image');

// "5 images · all cards matched", so missing art shows up without opening the warnings.
function renderArtStatus() {
  const count = state.assets.size;
  if (!count) {
    $('art-status').textContent = ART_HINT;
    return;
  }
  const want = state.cards.filter(needsArt);
  const missing = want.filter((card) => !findArt(card, state.assets)).length;
  const images = `${count} image${count === 1 ? '' : 's'}`;
  $('art-status').textContent = !want.length
    ? images
    : missing
      ? `${images} · ${missing} card${missing === 1 ? '' : 's'} without art`
      : `${images} · all cards matched`;
}

// The spreadsheet as it was read: one row per card, every column that has a value.
function renderData() {
  const view = $('data-view');
  view.replaceChildren();
  if (!state.cards.length) {
    const p = document.createElement('p');
    p.className = 'empty';
    p.textContent = 'Load a spreadsheet to see what was read from it.';
    view.append(p);
    return;
  }
  const seen = new Set();
  const cols = state.columns
    .map((col, i) => ({ col, header: state.headers[i] || col }))
    .filter(({ col }) => col && !seen.has(col) && seen.add(col) && state.cards.some((c) => c.fields[col]));

  const note = document.createElement('p');
  note.className = 'hint';
  note.textContent = `${state.sheetName}: ${state.cards.length} cards. Empty columns and rows with a count of 0 are left out. Click a row to see its card.`;
  const wrap = document.createElement('div');
  wrap.className = 'data-wrap';
  const table = document.createElement('table');
  table.className = 'data';
  const head = table.createTHead().insertRow();
  const th = (text, title) => {
    const cell = document.createElement('th');
    cell.textContent = text;
    if (title) cell.title = title;
    head.append(cell);
    return cell;
  };
  th('Row');
  th('Art');
  for (const { col, header } of cols) {
    const cell = th(header);
    // Shows how a header was understood, e.g. "Effects" is read as the text column.
    if (header.toLowerCase() !== col && header.toLowerCase().replace(/\s+/g, '_') !== col) {
      const as = document.createElement('small');
      as.textContent = col;
      cell.append(as);
    }
  }
  const body = table.createTBody();
  for (const card of state.cards) {
    const tr = body.insertRow();
    tr.insertCell().textContent = card.row;
    const art = tr.insertCell();
    if (!needsArt(card)) art.textContent = '';
    else if (findArt(card, state.assets)) {
      art.textContent = '✓';
      art.className = 'ok';
    } else {
      art.textContent = 'none';
      art.className = 'missing';
    }
    for (const { col } of cols) {
      const cell = tr.insertCell();
      cell.textContent = card.fields[col] ?? '';
      if (cell.textContent.length > 40) cell.className = 'long';
    }
    tr.addEventListener('click', () => {
      const canvas = state.canvases.get(card.id);
      if (canvas) openLightbox(canvas);
    });
  }
  wrap.append(table);
  view.append(note, wrap);
}

function drawBackPreview() {
  const canvas = $('back-preview');
  const ctx = canvas.getContext('2d');
  const first = decks()[0];
  const back = renderBack({
    image: state.back,
    px: { width: canvas.width * 2, height: canvas.height * 2 },
    title: first?.name || 'Deck',
    color: first ? deckColor(first) : undefined,
  });
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(back, 0, 0, canvas.width, canvas.height);
}

function openLightbox(source) {
  const canvas = $('lightbox-canvas');
  canvas.width = source.width;
  canvas.height = source.height;
  canvas.getContext('2d').drawImage(source, 0, 0);
  $('lightbox').hidden = false;
}

// ---- Exports ------------------------------------------------------------------

function cloudPackStale() {
  const pack = state.cloudPack;
  return !!pack && (pack.token !== renderToken || pack.quality !== settings.quality);
}

function ttsLocation() {
  if (settings.ttsMode === 'cloud') {
    const pack = state.cloudPack;
    if (!pack) return { error: 'Start with step 1: download the pictures to upload.' };
    if (cloudPackStale()) {
      return { error: 'Your cards changed since you downloaded the pictures. Do step 1 again; links for pictures that didn\'t change fill in by themselves.' };
    }
    const missing = pack.files.filter((f) => !isLink(cloudLinks[f.hash] || ''));
    if (missing.length) {
      return { error: `Step 3: paste the Steam Cloud link for ${missing.length} more picture${missing.length === 1 ? '' : 's'}.` };
    }
    const links = Object.fromEntries(pack.files.map((f) => [f.hash, cleanInput(cloudLinks[f.hash])]));
    return { location: { mode: 'cloud', links } };
  }
  if (settings.ttsMode === 'web') {
    const url = cleanInput(settings.baseUrl);
    if (!/^https?:\/\/\S+/i.test(url)) return { error: 'Enter the web address (starting with https://) the pictures will be uploaded to.' };
    return { location: { mode: 'web', baseUrl: url } };
  }
  const folder = cleanInput(settings.savedObjects);
  if (!folder) return { error: 'Enter your Saved Objects folder above so TTS can find the pictures.' };
  if (folder.startsWith('~')) return { error: 'Use the full folder path; TTS doesn\'t understand "~".' };
  return { location: { mode: 'local', savedObjects: folder } };
}

function updateExportButtons() {
  const ready = state.cards.length > 0 && !state.busy;
  $('export-images').disabled = !ready;
  $('cloud-pack').disabled = !ready;
  $('cloud-links').classList.toggle('stale', cloudPackStale());
  const { error } = ttsLocation();
  $('export-tts').disabled = !ready || !!error;
  $('tts-reason').textContent = state.cards.length ? error || '' : '';
}

async function runExport(kind) {
  if (state.busy) return;
  state.busy = true;
  updateExportButtons();
  try {
    await rerenderIfNeeded();
    const common = {
      decks: decks(),
      getCanvas: (card) => state.canvases.get(card.id),
      getBack,
      onProgress: setStatus,
    };
    const base = (state.sheetName || 'cards').replace(/\.(csv|tsv|txt|xlsx)$/i, '');
    if (kind === 'images') {
      const blob = await buildImagesZip(common);
      download(blob, `${base} - card images.zip`);
      setStatus('Done! Check your downloads.');
    } else if (kind === 'cloud-pack') {
      const prepared = await prepareTtsImages({ ...common, cardPx: cardPx(), quality: settings.quality });
      const files = cloudFiles(prepared);
      state.cloudPack = { token: renderToken, quality: settings.quality, prepared, files };
      download(await buildUploadZip(files, setStatus), `${base} - upload to Steam Cloud.zip`);
      renderCloudLinks();
      const todo = files.filter((f) => !isLink(cloudLinks[f.hash] || '')).length;
      setStatus(
        todo
          ? `Now upload ${todo === files.length ? 'the' : `the ${todo} new`} picture${todo === 1 ? '' : 's'} in TTS (step 2), then paste the links (step 3).`
          : 'All links are already filled in from last time. Download the TTS deck (step 4).',
      );
    } else {
      const { location } = ttsLocation();
      const prepared =
        location.mode === 'cloud'
          ? state.cloudPack.prepared
          : await prepareTtsImages({ ...common, cardPx: cardPx(), quality: settings.quality });
      const describe = (card) => cardDescription(card.fields, resolveLayout(card).layout.hover);
      const blob = await buildTtsZip({ prepared, getCanvas: common.getCanvas, location, describe, onProgress: setStatus });
      download(blob, `${base} - TTS.zip`);
      $('tts-load').scrollIntoView({ behavior: 'smooth' }); // walk them through the next steps
      setStatus('Done! Check your downloads.');
    }
  } catch (err) {
    console.error(err);
    setStatus(`Export failed: ${err.message}`);
  } finally {
    state.busy = false;
    updateExportButtons();
  }
}

// One row per image to upload: which deck it belongs to, its file name, and a box for its link.
function renderCloudLinks() {
  const box = $('cloud-links');
  box.replaceChildren();
  const pack = state.cloudPack;
  if (!pack) return;
  for (const file of pack.files) {
    const row = document.createElement('label');
    row.className = 'cloud-row';
    const info = document.createElement('span');
    info.className = 'cloud-file';
    const label = document.createElement('span');
    label.textContent = file.label;
    const name = document.createElement('code');
    name.textContent = file.name;
    info.append(label, name);
    const input = document.createElement('input');
    input.type = 'url';
    input.spellcheck = false;
    input.placeholder = 'Paste the Steam Cloud link';
    input.value = cloudLinks[file.hash] || '';
    input.dataset.hash = file.hash;
    const note = document.createElement('span');
    note.className = 'cloud-note';
    const check = () => {
      const value = cleanInput(input.value);
      const ok = isLink(value);
      row.classList.toggle('done', ok);
      row.classList.toggle('bad', !!value && !ok);
      note.textContent = !value ? '' : !ok ? 'That isn\'t a link.' : looksLikeSteamCloud(value) ? '' : 'Not a Steam Cloud link? It will still be used.';
    };
    input.addEventListener('input', () => {
      const value = cleanInput(input.value);
      if (value) cloudLinks[file.hash] = value;
      else delete cloudLinks[file.hash];
      saveCloudLinks();
      check();
      updateExportButtons();
    });
    check();
    row.append(info, input, note);
    box.append(row);
  }
}

async function rerenderIfNeeded() {
  if (state.cards.every((c) => state.canvases.has(c.id))) return;
  await rerender();
}

// ---- Drag and drop -------------------------------------------------------------

async function filesFromEntry(entry) {
  if (entry.isFile) return [await new Promise((res, rej) => entry.file(res, rej))];
  if (!entry.isDirectory) return [];
  const reader = entry.createReader();
  const out = [];
  for (;;) {
    const batch = await new Promise((res, rej) => reader.readEntries(res, rej));
    if (!batch.length) break;
    for (const child of batch) out.push(...(await filesFromEntry(child)));
  }
  return out;
}

async function filesFromDrop(dt) {
  const entries = [...dt.items].map((i) => i.webkitGetAsEntry?.()).filter(Boolean);
  if (!entries.length) return [...dt.files];
  const nested = await Promise.all(entries.map(filesFromEntry));
  return nested.flat();
}

async function handleFiles(files, target) {
  if (target === 'back') {
    const img = files.find((f) => IMAGE_EXT.test(f.name));
    if (img) await setBack(img);
    return;
  }
  const sheet = files.find((f) => SHEET_EXT.test(f.name));
  const images = files.filter((f) => IMAGE_EXT.test(f.name));
  if (images.length) await addArt(images);
  if (sheet) await loadSpreadsheet(sheet);
}

function setupDragAndDrop() {
  let depth = 0;
  const overlay = $('drop-overlay');
  window.addEventListener('dragenter', (e) => {
    if (![...(e.dataTransfer?.types || [])].includes('Files')) return;
    depth++;
    overlay.hidden = false;
  });
  window.addEventListener('dragleave', () => {
    depth = Math.max(0, depth - 1);
    if (!depth) overlay.hidden = true;
  });
  window.addEventListener('dragover', (e) => e.preventDefault());
  window.addEventListener('drop', async (e) => {
    e.preventDefault();
    depth = 0;
    overlay.hidden = true;
    document.querySelectorAll('[data-drop].over').forEach((d) => d.classList.remove('over'));
    const target = e.target.closest?.('[data-drop]')?.dataset.drop;
    await handleFiles(await filesFromDrop(e.dataTransfer), target);
  });
  document.querySelectorAll('[data-drop]').forEach((zone) => {
    zone.addEventListener('dragover', () => zone.classList.add('over'));
    zone.addEventListener('dragleave', () => zone.classList.remove('over'));
  });
}

// The chosen look: its description under the picker, and the Template & guide tab
// (its template, examples, columns and any guide of its own).
function describeLayout() {
  const layout = getLayout(settings.layout) || LAYOUTS[0];
  $('layout-desc').textContent = layout.description || '';
  $('look-title').textContent = layout.name;
  $('look-desc').textContent = layout.description || '';
  $('template-download').dataset.template = layout.id;
  const hasArt = layout.elements.some((e) => e.type === 'image');
  document.querySelectorAll('[data-needs-art]').forEach((el) => (el.hidden = !hasArt));
  let ownColumns = false;
  document.querySelectorAll('[data-guide]').forEach((el) => {
    el.hidden = el.dataset.guide !== layout.id;
    if (!el.hidden && el.hasAttribute('data-guide-columns')) ownColumns = true;
  });
  $('look-columns-block').hidden = ownColumns;
  const table = $('look-columns');
  table.replaceChildren();
  for (const column of templateColumns(layout)) {
    const tr = table.insertRow();
    const th = document.createElement('th');
    th.textContent = column === 'w' ? '[W]' : column;
    tr.append(th);
    tr.insertCell().textContent = columnHelp(column, layout.id);
  }
  renderLookExamples(layout);
}

async function renderLookExamples(layout) {
  const manifest = await getManifest();
  if (settings.layout !== layout.id) return; // the look changed meanwhile
  const table = $('look-examples');
  table.replaceChildren();
  const files = examplesFor(manifest, layout.id);
  for (const file of files) {
    const entry = manifest[file];
    const tr = table.insertRow();
    const th = document.createElement('th');
    th.textContent = entry.title || file;
    tr.append(th);
    tr.insertCell().textContent = entry.description || '';
    const actions = tr.insertCell();
    actions.className = 'actions';
    const load = document.createElement('button');
    load.type = 'button';
    load.className = 'small';
    load.dataset.example = file;
    load.textContent = 'Load';
    load.addEventListener('click', () => loadExample(file, { layout: layout.id }));
    const csv = document.createElement('a');
    csv.className = 'small';
    csv.href = `examples/${file}`;
    csv.download = file;
    csv.textContent = 'Download .csv';
    actions.append(load, ' ', csv);
  }
  if (!files.length) {
    const tr = table.insertRow();
    tr.insertCell().textContent = 'No example for this look yet.';
  }
}

// The empty page: one sample card per look, drawn from its example. Click to try it.
async function renderLooks() {
  const box = $('looks');
  const manifest = await getManifest();
  const px = { width: 240, height: 335 };
  for (const layout of LAYOUTS) {
    const fig = document.createElement('button');
    fig.type = 'button';
    fig.className = 'look';
    fig.dataset.look = layout.id;
    const label = document.createElement('span');
    label.textContent = layout.name;
    fig.append(label);
    fig.addEventListener('click', () => changeLook(layout.id));
    box.append(fig);
    const [file] = examplesFor(manifest, layout.id);
    if (!file) continue;
    try {
      const text = await (await fetch(`examples/${file}`)).text();
      const { cards } = rowsToCards(parseDelimited(text, detectDelimiter(text, file)));
      const assets = new AssetStore();
      for (const f of await exampleArt(manifest[file])) assets.add(f.name, await decodeImage(f));
      const card = cards.find((c) => c.name === manifest[file].preview) || cards[0];
      if (card) fig.prepend(renderCard(card, { layout, px, assets }));
    } catch (err) {
      console.error(err);
    }
  }
}

// Small background samples in a layout's guide (e.g. RossQuest's Aura colors):
// <figure data-swatch="layout-id" data-value="Knowledge 2, Passion 1" data-style="marble">
// is drawn with that layout's own blend element, so the guide can't drift from the cards.
function renderSwatches() {
  for (const fig of document.querySelectorAll('[data-swatch]')) {
    const layout = getLayout(fig.dataset.swatch);
    const blend = layout?.elements.find((e) => e.type === 'blend');
    if (!blend) continue;
    const fields = { [blend.field]: fig.dataset.value || '' };
    if (blend.styleField) fields[blend.styleField] = fig.dataset.style || '';
    const card = { name: fig.dataset.value || 'none', fields };
    const canvas = renderCard(card, { layout: { ...layout, elements: [blend] }, px: { width: 168, height: 236 } });
    fig.prepend(canvas);
  }
}

// Chooses a layout from code (no re-render; the caller renders next).
function setLayout(id) {
  const layout = getLayout(id);
  if (!layout) return;
  settings.layout = layout.id;
  saveSettings();
  $('layout-select').value = layout.id;
  describeLayout();
}

// ---- Setup ------------------------------------------------------------------------

function setupControls() {
  const layoutSelect = $('layout-select');
  for (const l of LAYOUTS) layoutSelect.add(new Option(l.name, l.id));
  layoutSelect.value = (getLayout(settings.layout) || LAYOUTS[0]).id;
  settings.layout = layoutSelect.value;
  describeLayout();
  layoutSelect.addEventListener('change', () => changeLook(layoutSelect.value));
  $('template-download').addEventListener('click', () => {
    const layout = getLayout(settings.layout) || LAYOUTS[0];
    download(new Blob([templateCsv(layout)], { type: 'text/csv' }), `${layout.id}-template.csv`);
  });
  renderSwatches();
  $('layout-ids').innerHTML = LAYOUTS.map((l) => `<code>${l.id}</code>`).join(', ');

  const sizeSelect = $('size-select');
  for (const s of CARD_SIZES) sizeSelect.add(new Option(s.label, s.id));
  sizeSelect.value = getSize(settings.size).id;
  sizeSelect.disabled = CARD_SIZES.length < 2;
  sizeSelect.addEventListener('change', () => {
    settings.size = sizeSelect.value;
    saveSettings();
    rerender();
  });

  // The TTS help shows only the steps for the chosen mode, with the user's folder or address filled in.
  const fillHelp = () => {
    const typed = cleanInput(settings.savedObjects);
    const values = {
      savedObjects: typed && savedObjectsFolder(typed),
      imagesFolder: typed && localImagesFolder(typed),
      baseUrl: cleanInput(settings.baseUrl),
    };
    document.querySelectorAll('[data-fill]').forEach((el) => {
      el.textContent = values[el.dataset.fill] || el.dataset.empty;
    });
  };
  const showMode = () => {
    $('tts-cloud').hidden = settings.ttsMode !== 'cloud';
    $('tts-local').hidden = settings.ttsMode !== 'local';
    $('tts-web').hidden = settings.ttsMode !== 'web';
    document.querySelectorAll('[data-help-mode]').forEach((el) => (el.hidden = !el.dataset.helpMode.split(' ').includes(settings.ttsMode)));
    fillHelp();
    updateExportButtons();
  };
  document.querySelectorAll('input[name="tts-mode"]').forEach((radio) => {
    radio.checked = radio.value === settings.ttsMode;
    radio.addEventListener('change', () => {
      settings.ttsMode = radio.value;
      saveSettings();
      showMode();
    });
  });
  showMode();

  const bindText = (id, key) => {
    const input = $(id);
    input.value = settings[key];
    input.addEventListener('input', () => {
      settings[key] = input.value;
      saveSettings();
      fillHelp();
      updateExportButtons();
    });
  };
  bindText('tts-folder', 'savedObjects');
  bindText('tts-url', 'baseUrl');

  const quality = $('tts-quality');
  quality.value = settings.quality;
  quality.addEventListener('change', () => {
    settings.quality = quality.value;
    saveSettings();
    updateExportButtons(); // Steam Cloud images were made at the old resolution
  });

  $('sheet-input').addEventListener('change', (e) => e.target.files[0] && loadSpreadsheet(e.target.files[0]));
  $('art-input').addEventListener('change', (e) => addArt([...e.target.files]));
  $('art-folder-input').addEventListener('change', (e) => addArt([...e.target.files]));
  $('back-input').addEventListener('change', (e) => e.target.files[0] && setBack(e.target.files[0]));
  $('clear-back').addEventListener('click', () => {
    $('back-input').value = '';
    setBack(null);
  });
  $('clear-art').addEventListener('click', () => {
    state.assets = new AssetStore();
    state.exampleArt = false;
    $('art-input').value = '';
    $('art-folder-input').value = '';
    document.querySelector('[data-drop="art"]').classList.remove('loaded');
    $('clear-art').hidden = true;
    rerender();
  });
  document.querySelectorAll('[data-tab], [data-tab-link]').forEach((button) => {
    if (button.matches('.main')) return;
    button.addEventListener('click', () => showTab(button.dataset.tab || button.dataset.tabLink));
  });
  $('lightbox').addEventListener('click', () => ($('lightbox').hidden = true));
  document.addEventListener('keydown', (e) => e.key === 'Escape' && ($('lightbox').hidden = true));

  $('export-images').addEventListener('click', () => runExport('images'));
  $('export-tts').addEventListener('click', () => runExport('tts'));
  $('cloud-pack').addEventListener('click', () => runExport('cloud-pack'));
}

async function init() {
  setupControls();
  setupDragAndDrop();
  await loadFonts();
  drawBackPreview();
  renderLooks();
  await loadHandoff();
  // The sending site reuses this tab for the next batch, which only changes the link's "#" part.
  window.addEventListener('hashchange', loadHandoff);
  document.body.dataset.ready = 'true';
}

init();
