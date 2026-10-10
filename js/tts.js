// Tabletop Simulator deck building: packing cards into grid sheets and writing
// the Saved Object JSON. Pure logic, unit-tested in Node.
//
// How TTS custom decks work: a deck's faces come from one or more "sheet"
// images, each a grid of up to 10 × 7 cards. Every card names its sheet and
// slot with CardID = sheetKey * 100 + slotIndex. One back image is shared.
import { toTtsText, splitList } from './richtext.js';

export const MAX_COLUMNS = 10;
export const MAX_ROWS = 7;
// TTS can use the last slot of a 10 × 7 sheet as the "hidden" face, so we
// leave it empty: 69 cards per sheet.
export const MAX_PER_SHEET = MAX_COLUMNS * MAX_ROWS - 1;

export const SHEET_LIMITS = {
  high: 8192, // full 300 DPI cards fit in a 10 × 7 poker sheet
  compatible: 4096, // safest for older graphics cards
};

// uniqueCount cards → [{ start, count, cols, rows }]
export function planSheets(uniqueCount) {
  const sheets = [];
  for (let start = 0; start < uniqueCount; start += MAX_PER_SHEET) {
    const count = Math.min(MAX_PER_SHEET, uniqueCount - start);
    // Roughly square grids waste the fewest slots; TTS needs at least 2 × 2.
    let rows = Math.min(MAX_ROWS, Math.max(2, Math.ceil(Math.sqrt(count))));
    let cols = Math.max(2, Math.ceil(count / rows));
    if (cols > MAX_COLUMNS) {
      cols = MAX_COLUMNS;
      rows = Math.ceil(count / cols);
    }
    sheets.push({ start, count, cols, rows });
  }
  return sheets;
}

// Card pixel size on a sheet, scaled down (never up) to keep the sheet within maxSheetPx.
export function sheetCardPx(cardPx, cols, rows, maxSheetPx) {
  const scale = Math.min(1, maxSheetPx / (cols * cardPx.width), maxSheetPx / (rows * cardPx.height));
  return { width: Math.floor(cardPx.width * scale), height: Math.floor(cardPx.height * scale) };
}

export function slug(text) {
  return (
    String(text || '')
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'deck'
  );
}

// Saved Object file names are shown in TTS's browser, so keep them readable.
export function safeFileName(text) {
  return String(text || 'Deck').replace(/[\\/:*?"<>|]+/g, '').trim().slice(0, 80) || 'Deck';
}

// The folder the TTS download unzips to, inside Saved Objects.
export const TTS_FOLDER = 'Card Builder';

// Tidies a pasted folder path or web address: Windows "Copy as path" wraps it in quotes.
export function cleanInput(text) {
  return String(text ?? '')
    .trim()
    .replace(/^(["'])(.*)\1$/, '$2')
    .trim();
}

const isWindowsPath = (p) => /^[a-zA-Z]:/.test(p) || p.includes('\\');

// The Saved Objects folder from what was typed. Also accepts a file:/// address, or
// the Card Builder (or Card Builder/images) folder itself, since those are easy slips.
export function savedObjectsFolder(input) {
  let folder = cleanInput(input).replace(/^file:\/\//i, '');
  if (/^\/[a-zA-Z]:/.test(folder)) folder = folder.slice(1); // file:///C:/… → C:/…
  folder = folder.replace(/[\\/]+$/, '');
  const tail = new RegExp(`[\\\\/]${TTS_FOLDER}([\\\\/]images)?$`, 'i');
  return folder.replace(tail, '');
}

// Where the card images end up once the download is unzipped into Saved Objects.
export function localImagesFolder(savedObjects) {
  const root = savedObjectsFolder(savedObjects);
  const sep = isWindowsPath(root) ? '\\' : '/';
  return [root.replace(/[\\/]/g, sep), TTS_FOLDER, 'images'].join(sep);
}

// Where TTS will load an image from.
//   Windows:   C:\…\Saved Objects\Card Builder\images\name.jpg   (plain path, as TTS's docs show)
//   Linux/Mac: file:///home/…/Saved Objects/Card Builder/images/name.jpg
//   Web:       https://example.com/decks/name.jpg
// Tested in TTS on Linux: a plain /home/… path is treated as a web address
// ("Cannot connect to destination host"), so non-Windows paths need file:///.
export function imageUrl(fileName, location) {
  if (location.mode === 'web') {
    const base = cleanInput(location.baseUrl).replace(/\/*$/, '/');
    return base + encodeURIComponent(fileName);
  }
  if (cleanInput(location.savedObjects).startsWith('~')) {
    throw new Error('Use the full folder path (TTS does not understand "~").');
  }
  const folder = localImagesFolder(location.savedObjects);
  if (isWindowsPath(folder)) return `${folder}\\${fileName}`;
  return `file://${folder}/${fileName}`;
}

// Columns the description handles itself (or that aren't card text at all).
const DESCRIBED = new Set(['name', 'count', 'deck', 'layout', 'art', 'color', 'type', 'subtype', 'tags', 'cost', 'text', 'flavor', 'stats']);

const columnLabel = (key) => key.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());

export function cardDescription(fields) {
  const tags = splitList(fields.tags).join(' · ');
  const typeLine = [fields.type, fields.subtype, tags].filter(Boolean).join(' — ');
  const parts = [];
  if (typeLine) parts.push(`[b]${typeLine}[/b]`);
  if (fields.cost) parts.push(`Cost: ${fields.cost}`);
  if (fields.text) parts.push(toTtsText(fields.text));
  if (fields.stats) parts.push(`[b]${fields.stats}[/b]`);
  // Any other filled-in columns (e.g. a layout's stats), labelled by column name.
  const extra = Object.entries(fields).filter(([key, value]) => !DESCRIBED.has(key) && String(value).trim());
  if (extra.length) parts.push(`[b]${extra.map(([key, value]) => `${columnLabel(key)} ${value}`).join(' · ')}[/b]`);
  if (fields.flavor) parts.push(`[i]${toTtsText(fields.flavor)}[/i]`);
  return parts.join('\n');
}

export function randomGuid(rng = Math.random) {
  return Array.from({ length: 6 }, () => Math.floor(rng() * 16).toString(16)).join('');
}

const TRANSFORM = { posX: 0, posY: 1, posZ: 0, rotX: 0, rotY: 180, rotZ: 180, scaleX: 1, scaleY: 1, scaleZ: 1 };

function baseObject(name, nickname, description, guid) {
  return {
    GUID: guid,
    Name: name,
    Transform: { ...TRANSFORM },
    Nickname: nickname,
    Description: description,
    GMNotes: '',
    ColorDiffuse: { r: 0.713235259, g: 0.713235259, b: 0.713235259 },
    Locked: false,
    Grid: true,
    Snap: true,
    IgnoreFoW: false,
    MeasureMovement: false,
    DragSelectable: true,
    Autoraise: true,
    Sticky: true,
    Tooltip: true,
    GridProjection: false,
    HideWhenFaceDown: true,
    Hands: true,
    SidewaysCard: false,
    LuaScript: '',
    LuaScriptState: '',
    XmlUI: '',
  };
}

// deck: { name, cards: [{ name, count, fields }] } in sheet order (the order passed to planSheets)
// sheets: [{ start, count, cols, rows, faceUrl }]
// Returns the full Saved Object file contents as a JS object.
export function buildSavedObject({ deck, sheets, backUrl, rng = Math.random }) {
  const usedKeys = new Set();
  const customDeck = {};
  const sheetKeys = sheets.map((sheet) => {
    let key;
    do key = 1000 + Math.floor(rng() * 9000);
    while (usedKeys.has(key));
    usedKeys.add(key);
    customDeck[key] = {
      FaceURL: sheet.faceUrl,
      BackURL: backUrl,
      NumWidth: sheet.cols,
      NumHeight: sheet.rows,
      BackIsHidden: true,
      UniqueBack: false,
      Type: 0,
    };
    return key;
  });

  const cardObjects = [];
  deck.cards.forEach((card, i) => {
    const sheetIndex = sheets.findIndex((s) => i >= s.start && i < s.start + s.count);
    const key = sheetKeys[sheetIndex];
    const cardId = key * 100 + (i - sheets[sheetIndex].start);
    for (let copy = 0; copy < card.count; copy++) {
      cardObjects.push({
        ...baseObject('Card', card.name, cardDescription(card.fields), randomGuid(rng)),
        CardID: cardId,
        CustomDeck: { [key]: customDeck[key] },
      });
    }
  });

  let object;
  if (cardObjects.length === 1) {
    object = cardObjects[0];
  } else {
    object = {
      ...baseObject('DeckCustom', deck.name, `${cardObjects.length} cards`, randomGuid(rng)),
      Hands: false,
      DeckIDs: cardObjects.map((c) => c.CardID),
      CustomDeck: customDeck,
      ContainedObjects: cardObjects,
    };
  }

  return {
    SaveName: '',
    Date: '',
    VersionNumber: '',
    GameMode: '',
    GameType: '',
    GameComplexity: '',
    Tags: [],
    Gravity: 0.5,
    PlayArea: 0.5,
    Table: '',
    Sky: '',
    Note: '',
    TabStates: {},
    LuaScript: '',
    LuaScriptState: '',
    XmlUI: '',
    ObjectStates: [object],
  };
}

export function versionStamp(date = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}${p(date.getMonth() + 1)}${p(date.getDate())}-${p(date.getHours())}${p(date.getMinutes())}${p(date.getSeconds())}`;
}
