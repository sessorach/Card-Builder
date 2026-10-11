// Builds the downloadable zips. Browser-only (canvas + global JSZip).
import { canvasToBlob, scaleCanvas } from './render.js';
import {
  planSheets,
  sheetCardPx,
  buildSavedObject,
  imageUrl,
  slug,
  safeFileName,
  versionStamp,
  contentHash,
  cloudSheetName,
  cloudBackName,
  savedObjectsFolder,
  localImagesFolder,
  cleanInput,
  SHEET_LIMITS,
  TTS_FOLDER,
} from './tts.js';

export { TTS_FOLDER };
const SHEET_TYPE = 'image/jpeg';
const SHEET_QUALITY = 0.92;

const pad = (n, width) => String(n).padStart(width, '0');

// decks: [{ name, cards }], getCanvas(card) → canvas, getBack(deck) → canvas
export async function buildImagesZip({ decks, getCanvas, getBack, onProgress = () => {} }) {
  const zip = new JSZip();
  const total = decks.reduce((n, d) => n + d.cards.length, 0);
  let done = 0;
  for (const deck of decks) {
    const folder = zip.folder(safeFileName(deck.name));
    const width = Math.max(2, String(deck.cards.length).length);
    for (const [i, card] of deck.cards.entries()) {
      folder.file(`${pad(i + 1, width)}-${slug(card.name)}.png`, await canvasToBlob(getCanvas(card)));
      onProgress(`Encoding card images… ${++done}/${total}`);
    }
    folder.file('back.png', await canvasToBlob(getBack(deck)));
  }
  onProgress('Zipping…');
  return zip.generateAsync({ type: 'blob' });
}

function drawSheet(cards, sheet, getCanvas, cellPx) {
  const canvas = document.createElement('canvas');
  canvas.width = sheet.cols * cellPx.width;
  canvas.height = sheet.rows * cellPx.height;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (let i = 0; i < sheet.count; i++) {
    const card = cards[sheet.start + i];
    const col = i % sheet.cols;
    const row = Math.floor(i / sheet.cols);
    ctx.drawImage(getCanvas(card), col * cellPx.width, row * cellPx.height, cellPx.width, cellPx.height);
  }
  return canvas;
}

function instructions({ decks, location, manual }) {
  const lines = [
    'Card Builder: Tabletop Simulator decks',
    '======================================',
    '',
  ];
  const savedObjects = [
    '   Windows: Documents\\My Games\\Tabletop Simulator\\Saves\\Saved Objects',
    '   Mac:     ~/Library/Tabletop Simulator/Saves/Saved Objects',
    '   Linux:   ~/.local/share/Tabletop Simulator/Saves/Saved Objects',
  ];
  const spawn = (n) => [
    `${n}. In TTS, click Objects in the top menu, then Saved Objects, open the`,
    `   "${TTS_FOLDER}" folder, and click a deck to put it on the table.`,
  ];
  const nesting = [
    `   Afterwards, Saved Objects should contain "${TTS_FOLDER}" directly. If you see`,
    `   "${TTS_FOLDER}" inside another "${TTS_FOLDER}", move the inner one up.`,
  ];
  if (location.mode === 'cloud') {
    lines.push(
      `1. Move the whole "${TTS_FOLDER}" folder (the one this file is in) into your`,
      '   TTS "Saved Objects" folder:',
      ...savedObjects,
      ...nesting,
      ...spawn(2),
      '',
      'The card pictures load from your Steam Cloud, so everyone in your game sees',
      'them. Only the person putting the deck on the table needs these files.',
      '',
      'Cards blank or showing an image error? Check that each link was pasted next',
      'to the right file name in Card Builder, then download the deck again.',
    );
  } else if (location.mode === 'local') {
    lines.push(
      `1. Move the whole "${TTS_FOLDER}" folder (the one this file is in) into exactly`,
      '   this folder:',
      `   ${savedObjectsFolder(location.savedObjects)}`,
      ...nesting,
      ...spawn(2),
      '',
      'Cards blank or showing an image error? The decks look for their pictures in',
      'exactly this folder, so check they are there:',
      `   ${localImagesFolder(location.savedObjects)}`,
      'If they are and it still fails, choose "Steam Cloud" in Card Builder instead.',
      '',
      'These pictures load from files on this computer, so other players will not',
      'see them. To play with others, choose "Steam Cloud" in Card Builder.',
    );
  } else {
    lines.push(
      `1. Upload the files inside "${TTS_FOLDER}/images" so each one opens at:`,
      `   ${cleanInput(location.baseUrl).replace(/\/*$/, '/')}<file name>`,
      `2. Move the whole "${TTS_FOLDER}" folder (the one this file is in) into your`,
      '   TTS "Saved Objects" folder:',
      ...savedObjects,
      ...nesting,
      ...spawn(3),
      '',
      'Everyone in your game loads the pictures from your website.',
    );
  }
  if (location.mode !== 'cloud') {
    lines.push(
      '',
      'Another way, by hand: TTS can import each sheet itself and offers to upload',
      'it to your Steam Cloud. In TTS: Objects → Components → Custom → Deck, then',
      'for each sheet below:',
    );
    for (const m of manual) {
      lines.push(
        '',
        `  ${m.deck}${m.sheetCount > 1 ? ` (sheet ${m.index + 1} of ${m.sheetCount})` : ''}`,
        `    Face:   images/${m.face}`,
        `    Back:   images/${m.back}   (tick "Back is Hidden")`,
        `    Width: ${m.cols}   Height: ${m.rows}   Number: ${m.count}`,
      );
      if (m.copies !== m.count) {
        lines.push(`    Manual import gives one of each card; the Saved Object has all ${m.copies} copies.`);
      }
    }
  }
  lines.push('', `Decks in this export: ${decks.map((d) => d.name).join(', ')}`, '');
  return lines.join('\n');
}

async function encodeSheet(canvas) {
  const blob = await canvasToBlob(canvas, SHEET_TYPE, SHEET_QUALITY);
  const hash = contentHash(new Uint8Array(await blob.arrayBuffer()));
  return { blob, hash };
}

// Renders every deck's sheets and back once, as JPEGs with content hashes.
// Both the Steam Cloud upload pack and the TTS deck are built from this.
// Returns [{ deck, base, back: { blob, hash }, sheets: [{ ...plan, blob, hash }] }].
export async function prepareTtsImages({ decks, cardPx, getCanvas, getBack, quality, onProgress = () => {} }) {
  const maxSheet = SHEET_LIMITS[quality] || SHEET_LIMITS.high;
  const usedNames = new Set();
  const prepared = [];
  for (const deck of decks) {
    let base = safeFileName(deck.name);
    for (let n = 2; usedNames.has(base.toLowerCase()); n++) base = `${safeFileName(deck.name)} (${n})`;
    usedNames.add(base.toLowerCase());

    const back = await encodeSheet(getBack(deck));
    const plan = planSheets(deck.cards.length);
    const sheets = [];
    for (const [index, sheet] of plan.entries()) {
      onProgress(`Building sheet ${index + 1}/${plan.length} for ${deck.name}…`);
      const cellPx = sheetCardPx(cardPx, sheet.cols, sheet.rows, maxSheet);
      sheets.push({ ...sheet, index, ...(await encodeSheet(drawSheet(deck.cards, sheet, getCanvas, cellPx))) });
    }
    prepared.push({ deck, base, back, sheets });
  }
  return prepared;
}

// The images to upload to Steam Cloud, once each (decks sharing a back share
// one upload). Returns [{ hash, name, label, blob }].
export function cloudFiles(prepared) {
  const files = new Map();
  for (const { deck, base, back, sheets } of prepared) {
    for (const sheet of sheets) {
      if (!files.has(sheet.hash)) {
        const label = sheets.length > 1 ? `${deck.name}: sheet ${sheet.index + 1} of ${sheets.length}` : `${deck.name}: cards`;
        files.set(sheet.hash, { hash: sheet.hash, name: cloudSheetName(base, sheet.index, sheet.hash), label, blob: sheet.blob });
      }
    }
    if (files.has(back.hash)) {
      const shared = files.get(back.hash);
      if (shared.decks) shared.decks.push(deck.name);
    } else {
      files.set(back.hash, { hash: back.hash, name: cloudBackName(back.hash), decks: [deck.name], blob: back.blob });
    }
  }
  return [...files.values()].map((f) => (f.decks ? { ...f, label: `Card back (${f.decks.join(', ')})` } : f));
}

export async function buildUploadZip(files, onProgress = () => {}) {
  const zip = new JSZip();
  const folder = zip.folder('Card Builder uploads');
  for (const f of files) folder.file(f.name, f.blob);
  onProgress('Zipping…');
  return zip.generateAsync({ type: 'blob' });
}

// location: { mode: 'cloud', links: { hash: url } } | { mode: 'local', savedObjects } | { mode: 'web', baseUrl }
export async function buildTtsZip({ prepared, getCanvas, location, describe, onProgress = () => {} }) {
  const zip = new JSZip();
  const root = zip.folder(TTS_FOLDER);
  const cloud = location.mode === 'cloud';
  const images = cloud ? null : root.folder('images');
  const version = versionStamp();
  const manual = [];

  // Steam Cloud: the pasted link for that exact image. Otherwise: write the file and point at it.
  const place = (name, image) => {
    if (cloud) return location.links[image.hash];
    images.file(name, image.blob);
    return imageUrl(name, location);
  };

  for (const { deck, base, back, sheets } of prepared) {
    const prefix = `${slug(base)}-${version}`;
    const backFile = `${prefix}-back.jpg`;
    const backUrl = place(backFile, back);
    const placed = sheets.map((sheet) => {
      const face = `${prefix}-sheet${sheet.index + 1}.jpg`;
      const copies = deck.cards.slice(sheet.start, sheet.start + sheet.count).reduce((n, c) => n + c.count, 0);
      manual.push({ deck: deck.name, index: sheet.index, sheetCount: sheets.length, face, back: backFile, cols: sheet.cols, rows: sheet.rows, count: sheet.count, copies });
      return { ...sheet, faceUrl: place(face, sheet) };
    });

    const saved = buildSavedObject({ deck, sheets: placed, backUrl, describe });
    root.file(`${base}.json`, JSON.stringify(saved, null, 2));

    // Thumbnail shown in TTS's Saved Objects browser.
    const first = getCanvas(deck.cards[0]);
    const thumbH = 256;
    const thumb = scaleCanvas(first, Math.round((first.width / first.height) * thumbH), thumbH);
    root.file(`${base}.png`, await canvasToBlob(thumb));
  }

  root.file('HOW TO IMPORT.txt', instructions({ decks: prepared.map((p) => p.deck), location, manual }));
  onProgress('Zipping…');
  return zip.generateAsync({ type: 'blob' });
}
