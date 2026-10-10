// Page wiring: inputs → state → preview → exports.
import { parseDelimited, detectDelimiter, rowsToCards, groupByDeck } from './spreadsheet.js';
import { readXlsx } from './xlsx.js';
import { LAYOUTS, getLayout } from '../layouts/index.js';
import { CARD_SIZES, DEFAULT_SIZE_ID, getSize, sizePx } from './sizes.js';
import { AssetStore, decodeImage, renderCard, renderBack, findArt, cardAccent } from './render.js';
import { loadFonts } from './fonts.js';
import { buildImagesZip, buildTtsZip, prepareTtsImages, cloudFiles, buildUploadZip } from './export.js';
import { templateCsv } from './template.js';
import { cleanInput, savedObjectsFolder, localImagesFolder, isLink, looksLikeSteamCloud } from './tts.js';

const $ = (id) => document.getElementById(id);
const IMAGE_EXT = /\.(png|jpe?g|webp|gif|bmp|avif)$/i;
const SHEET_EXT = /\.(csv|tsv|txt|xlsx)$/i;

const state = {
  sheetName: '',
  cards: [],
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
    const found = LAYOUTS.find((l) => l.id === want || norm(l.name) === want);
    if (found) return { layout: found };
    return { layout: getLayout(settings.layout) || LAYOUTS[0], unknown: card.layout };
  }
  return { layout: getLayout(settings.layout) || LAYOUTS[0] };
}

function setStatus(text) {
  $('status').textContent = text;
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

async function loadSpreadsheet(file) {
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
    const { cards, warnings } = rowsToCards(rows);
    state.sheetName = file.name;
    state.cards = cards;
    state.sheetWarnings = warnings;
    const sheetDrop = document.querySelector('[data-drop="sheet"]');
    sheetDrop.classList.toggle('loaded', cards.length > 0);
    const total = cards.reduce((n, c) => n + c.count, 0);
    $('sheet-status').textContent = `${file.name}: ${cards.length} cards (${total} with copies)`;
    await rerender();
  } catch (err) {
    console.error(err);
    state.sheetWarnings = [`Couldn't read ${file.name}: ${err.message}`];
    renderWarnings();
  }
}

async function addArt(files) {
  const images = files.filter((f) => IMAGE_EXT.test(f.name));
  if (!images.length) return;
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
  $('art-status').textContent = `${state.assets.size} images loaded`;
  setStatus('');
  await rerender();
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
  $('back-status').textContent = state.back ? state.backName : 'Optional: a back is generated per deck';
  await rerender();
}

async function loadExample(file) {
  try {
    const text = await (await fetch(`examples/${file}`)).text();
    const manifest = await (await fetch('examples/manifest.json')).json();
    const art = await Promise.all(
      (manifest[file] || []).map(async (name) => {
        const res = await fetch(`examples/art/${encodeURIComponent(name)}`);
        return res.ok ? new File([await res.blob()], name) : null;
      }),
    );
    await addArt(art.filter(Boolean));
    await loadSpreadsheet(new File([text], file, { type: 'text/csv' }));
  } catch (err) {
    console.error(err);
    setStatus(`Couldn't load the example: ${err.message}`);
  }
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

let renderToken = 0;
async function rerender() {
  const token = ++renderToken;
  state.canvases.clear();
  state.backs.clear();
  drawBackPreview();
  updateExportButtons();

  const container = $('decks');
  if (!state.cards.length) {
    renderWarnings();
    return;
  }
  container.replaceChildren();
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
      if (layout.elements.some((e) => e.type === 'image') && !findArt(card, state.assets)) {
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
      `Missing art (${names.length}): ${names.slice(0, 12).join(', ')}${names.length > 12 ? ', …' : ''}. Drop the images in step 2.`,
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
    if (!pack) return { error: 'Step 1: download the images to upload.' };
    if (cloudPackStale()) {
      return { error: 'Your cards changed since you downloaded the images. Download them again; links for images that didn\'t change fill in by themselves.' };
    }
    const missing = pack.files.filter((f) => !isLink(cloudLinks[f.hash] || ''));
    if (missing.length) {
      return { error: `Paste the Steam Cloud link for ${missing.length} more image${missing.length === 1 ? '' : 's'}.` };
    }
    const links = Object.fromEntries(pack.files.map((f) => [f.hash, cleanInput(cloudLinks[f.hash])]));
    return { location: { mode: 'cloud', links } };
  }
  if (settings.ttsMode === 'web') {
    const url = cleanInput(settings.baseUrl);
    if (!/^https?:\/\/\S+/i.test(url)) return { error: 'Enter the web address (starting with https://) the images will be uploaded to.' };
    return { location: { mode: 'web', baseUrl: url } };
  }
  const folder = cleanInput(settings.savedObjects);
  if (!folder) return { error: 'Enter your Saved Objects folder so TTS can find the images.' };
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
    const base = (state.sheetName || 'cards').replace(/\.[^.]+$/, '');
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
          ? `Upload ${todo === files.length ? 'these' : `the ${todo} new`} image${todo === 1 ? '' : 's'} in TTS, then paste the links below.`
          : 'All links are already filled in from last time. Download the TTS deck.',
      );
    } else {
      const { location } = ttsLocation();
      const prepared =
        location.mode === 'cloud'
          ? state.cloudPack.prepared
          : await prepareTtsImages({ ...common, cardPx: cardPx(), quality: settings.quality });
      const blob = await buildTtsZip({ prepared, getCanvas: common.getCanvas, location, onProgress: setStatus });
      download(blob, `${base} - TTS.zip`);
      $('tts-help').open = true; // walk them through the next steps
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
    document.querySelectorAll('.drop.over').forEach((d) => d.classList.remove('over'));
    const target = e.target.closest?.('[data-drop]')?.dataset.drop;
    await handleFiles(await filesFromDrop(e.dataTransfer), target);
  });
  document.querySelectorAll('[data-drop]').forEach((zone) => {
    zone.addEventListener('dragover', () => zone.classList.add('over'));
    zone.addEventListener('dragleave', () => zone.classList.remove('over'));
  });
}

// ---- Setup ------------------------------------------------------------------------

function setupControls() {
  const layoutSelect = $('layout-select');
  for (const l of LAYOUTS) layoutSelect.add(new Option(l.name, l.id));
  layoutSelect.value = getLayout(settings.layout) ? settings.layout : LAYOUTS[0].id;
  settings.layout = layoutSelect.value;
  const describe = () => {
    const layout = getLayout(settings.layout);
    $('layout-desc').textContent = layout?.description || '';
    $('download-template').textContent = `Download a blank ${layout?.name || ''} template (.csv)`;
  };
  describe();
  layoutSelect.addEventListener('change', () => {
    settings.layout = layoutSelect.value;
    saveSettings();
    describe();
    rerender();
  });
  $('download-template').addEventListener('click', () => {
    const layout = getLayout(settings.layout) || LAYOUTS[0];
    download(new Blob([templateCsv(layout)], { type: 'text/csv' }), `${layout.id}-template.csv`);
  });
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
    document.querySelectorAll('[data-help-mode]').forEach((el) => (el.hidden = el.dataset.helpMode !== settings.ttsMode));
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
    document.querySelector('[data-drop="art"]').classList.remove('loaded');
    $('art-status').innerHTML = 'Name each image after its card, e.g. <code>Block Party Boss.png</code>';
    rerender();
  });
  document.querySelectorAll('[data-example]').forEach((button) =>
    button.addEventListener('click', () => loadExample(button.dataset.example)),
  );
  $('show-columns').addEventListener('click', (e) => {
    e.preventDefault();
    $('columns').hidden = !$('columns').hidden;
    if (!$('columns').hidden) $('columns').scrollIntoView({ behavior: 'smooth' });
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
  document.body.dataset.ready = 'true';
}

init();
