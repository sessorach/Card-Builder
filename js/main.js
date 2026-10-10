// Page wiring: inputs → state → preview → exports.
import { parseDelimited, detectDelimiter, rowsToCards, groupByDeck } from './spreadsheet.js';
import { readXlsx } from './xlsx.js';
import { LAYOUTS, getLayout } from '../layouts/index.js';
import { CARD_SIZES, DEFAULT_SIZE_ID, getSize, sizePx } from './sizes.js';
import { AssetStore, decodeImage, loadFonts, renderCard, renderBack } from './render.js';
import { buildImagesZip, buildTtsZip } from './export.js';

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
  layout: 'classic',
  size: DEFAULT_SIZE_ID,
  ttsMode: 'local',
  savedObjects: '',
  baseUrl: '',
  quality: 'high',
  ...loadSettings(),
};
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

async function loadExample() {
  try {
    const text = await (await fetch('examples/example-cards.csv')).text();
    const { cards } = rowsToCards(parseDelimited(text));
    const artNames = [...new Set(cards.map((c) => c.art).filter(Boolean))];
    const art = await Promise.all(
      artNames.map(async (name) => {
        const res = await fetch(`examples/art/${encodeURIComponent(name)}`);
        return res.ok ? new File([await res.blob()], name) : null;
      }),
    );
    await addArt(art.filter(Boolean));
    await loadSpreadsheet(new File([text], 'example-cards.csv', { type: 'text/csv' }));
  } catch (err) {
    console.error(err);
    setStatus(`Couldn't load the example: ${err.message}`);
  }
}

// ---- Rendering ------------------------------------------------------------------

function deckColor(deck) {
  return deck.cards.find((c) => c.fields.color)?.fields.color;
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
  const missingArt = new Set();

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
      if (card.art && !state.assets.get(card.art)) missingArt.add(card.art);
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

function ttsLocation() {
  if (settings.ttsMode === 'web') {
    const url = settings.baseUrl.trim();
    if (!/^https?:\/\/\S+/i.test(url)) return { error: 'Enter the web address (starting with https://) the images will be uploaded to.' };
    return { location: { mode: 'web', baseUrl: url } };
  }
  const folder = settings.savedObjects.trim();
  if (!folder) return { error: 'Enter your Saved Objects folder so TTS can find the images.' };
  if (folder.startsWith('~')) return { error: 'Use the full folder path; TTS doesn\'t understand "~".' };
  return { location: { mode: 'local', savedObjects: folder } };
}

function updateExportButtons() {
  const ready = state.cards.length > 0 && !state.busy;
  $('export-images').disabled = !ready;
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
    } else {
      const { location } = ttsLocation();
      const blob = await buildTtsZip({ ...common, cardPx: cardPx(), location, quality: settings.quality });
      download(blob, `${base} - TTS.zip`);
    }
    setStatus('Done! Check your downloads.');
  } catch (err) {
    console.error(err);
    setStatus(`Export failed: ${err.message}`);
  } finally {
    state.busy = false;
    updateExportButtons();
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
  const describe = () => ($('layout-desc').textContent = getLayout(settings.layout)?.description || '');
  describe();
  layoutSelect.addEventListener('change', () => {
    settings.layout = layoutSelect.value;
    saveSettings();
    describe();
    rerender();
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

  const showMode = () => {
    $('tts-local').hidden = settings.ttsMode !== 'local';
    $('tts-web').hidden = settings.ttsMode !== 'web';
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
    $('art-status').innerHTML = 'Matched to the <code>art</code> column by file name';
    rerender();
  });
  $('load-example').addEventListener('click', loadExample);
  $('load-example-2').addEventListener('click', loadExample);
  $('show-columns').addEventListener('click', (e) => {
    e.preventDefault();
    $('columns').hidden = !$('columns').hidden;
    if (!$('columns').hidden) $('columns').scrollIntoView({ behavior: 'smooth' });
  });
  $('lightbox').addEventListener('click', () => ($('lightbox').hidden = true));
  document.addEventListener('keydown', (e) => e.key === 'Escape' && ($('lightbox').hidden = true));

  $('export-images').addEventListener('click', () => runExport('images'));
  $('export-tts').addEventListener('click', () => runExport('tts'));
}

async function init() {
  setupControls();
  setupDragAndDrop();
  await loadFonts();
  drawBackPreview();
  document.body.dataset.ready = 'true';
}

init();
