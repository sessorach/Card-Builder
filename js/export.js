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
  SHEET_LIMITS,
} from './tts.js';

export const TTS_FOLDER = 'Card Builder';
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
  if (location.mode === 'local') {
    lines.push(
      `1. Unzip so the "${TTS_FOLDER}" folder lands inside your TTS "Saved Objects" folder:`,
      `   ${location.savedObjects}`,
      '2. In TTS: Objects → Saved Objects → Card Builder, then click a deck to spawn it.',
      '',
      'These images are loaded from files on this computer, so other players will',
      'not see them. To play online, use "Web hosted" in Card Builder, or import',
      'manually (below) and let TTS upload the images to the Steam Cloud.',
    );
  } else {
    lines.push(
      `1. Upload everything in "${TTS_FOLDER}/images" so each file is reachable at:`,
      `   ${location.baseUrl.replace(/\/*$/, '/')}<file name>`,
      `2. Put the "${TTS_FOLDER}" folder (the .json and .png files) in your TTS "Saved Objects" folder.`,
      '3. In TTS: Objects → Saved Objects → Card Builder, then click a deck to spawn it.',
    );
  }
  lines.push(
    '',
    'Manual import (works for anyone; TTS offers to upload the images to Steam Cloud):',
    'Objects → Components → Custom → Deck, then for each sheet below:',
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
  lines.push('', `Decks in this export: ${decks.map((d) => d.name).join(', ')}`, '');
  return lines.join('\n');
}

// location: { mode: 'local', savedObjects } | { mode: 'web', baseUrl }
export async function buildTtsZip({ decks, cardPx, getCanvas, getBack, location, quality, onProgress = () => {} }) {
  const zip = new JSZip();
  const root = zip.folder(TTS_FOLDER);
  const images = root.folder('images');
  const version = versionStamp();
  const maxSheet = SHEET_LIMITS[quality] || SHEET_LIMITS.high;
  const manual = [];

  const urlFor = (file) =>
    location.mode === 'web'
      ? imageUrl(file, location)
      : imageUrl(file, {
          mode: 'local',
          folder: `${location.savedObjects.replace(/[\\/]+$/, '')}/${TTS_FOLDER}/images`,
        });

  const usedNames = new Set();
  for (const deck of decks) {
    let base = safeFileName(deck.name);
    for (let n = 2; usedNames.has(base.toLowerCase()); n++) base = `${safeFileName(deck.name)} (${n})`;
    usedNames.add(base.toLowerCase());
    const prefix = `${slug(base)}-${version}`;

    const backFile = `${prefix}-back.jpg`;
    images.file(backFile, await canvasToBlob(getBack(deck), SHEET_TYPE, SHEET_QUALITY));

    const plan = planSheets(deck.cards.length);
    const sheets = [];
    for (const [index, sheet] of plan.entries()) {
      onProgress(`Building sheet ${index + 1}/${plan.length} for ${deck.name}…`);
      const cellPx = sheetCardPx(cardPx, sheet.cols, sheet.rows, maxSheet);
      const canvas = drawSheet(deck.cards, sheet, getCanvas, cellPx);
      const face = `${prefix}-sheet${index + 1}.jpg`;
      images.file(face, await canvasToBlob(canvas, SHEET_TYPE, SHEET_QUALITY));
      sheets.push({ ...sheet, faceUrl: urlFor(face) });
      const copies = deck.cards.slice(sheet.start, sheet.start + sheet.count).reduce((n, c) => n + c.count, 0);
      manual.push({ deck: deck.name, index, sheetCount: plan.length, face, back: backFile, cols: sheet.cols, rows: sheet.rows, count: sheet.count, copies });
    }

    const saved = buildSavedObject({ deck, sheets, backUrl: urlFor(backFile) });
    root.file(`${base}.json`, JSON.stringify(saved, null, 2));

    // Thumbnail shown in TTS's Saved Objects browser.
    const first = getCanvas(deck.cards[0]);
    const thumbH = 256;
    const thumb = scaleCanvas(first, Math.round((first.width / first.height) * thumbH), thumbH);
    root.file(`${base}.png`, await canvasToBlob(thumb));
  }

  root.file('HOW TO IMPORT.txt', instructions({ decks, location, manual }));
  onProgress('Zipping…');
  return zip.generateAsync({ type: 'blob' });
}
