// Turns spreadsheet rows into card records. Pure logic, no DOM: unit-tested in Node.

// Alternate column names people are likely to use, mapped to the canonical field.
const HEADER_ALIASES = {
  'card name': 'name',
  title: 'name',
  qty: 'count',
  quantity: 'count',
  copies: 'count',
  amount: 'count',
  image: 'art',
  picture: 'art',
  'art file': 'art',
  artwork: 'art',
  rules: 'text',
  'rules text': 'text',
  ability: 'text',
  abilities: 'text',
  'flavor text': 'flavor',
  flavour: 'flavor',
  'flavour text': 'flavor',
  colour: 'color',
  template: 'layout',
  effects: 'text',
  effect: 'text',
  // A note in parentheses is normally ignored, but here it says what the column holds.
  'description (fluff)': 'flavor',
  fluff: 'flavor',
};

// Notes in parentheses are ignored, so "tags (separate with commas)" reads as "tags".
export function normalizeHeader(header) {
  const full = String(header ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
  if (HEADER_ALIASES[full]) return HEADER_ALIASES[full];
  const key = full.replace(/\([^)]*\)/g, '').trim().replace(/\s+/g, ' ');
  return HEADER_ALIASES[key] || key.replace(/ /g, '_');
}

// RFC 4180-style parser: quoted fields, doubled quotes, newlines inside quotes.
export function parseDelimited(text, delimiter = ',') {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  let i = 0;
  if (text.charCodeAt(0) === 0xfeff) i = 1; // BOM from Excel exports

  for (; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"' && field === '') {
      inQuotes = true;
    } else if (ch === delimiter) {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

export function detectDelimiter(text, filename = '') {
  if (/\.tsv$/i.test(filename)) return '\t';
  const firstLine = text.split(/\r?\n/, 1)[0] || '';
  const tabs = (firstLine.match(/\t/g) || []).length;
  const commas = (firstLine.match(/,/g) || []).length;
  const semis = (firstLine.match(/;/g) || []).length;
  if (tabs > commas && tabs >= semis) return '\t';
  if (semis > commas) return ';';
  return ',';
}

// rows: array of arrays, first row is the header.
// Returns { cards, warnings, columns }.
export function rowsToCards(rows) {
  const warnings = [];
  const nonEmpty = rows.filter((r) => r.some((c) => String(c ?? '').trim() !== ''));
  if (!nonEmpty.length) return { cards: [], warnings: ['The spreadsheet is empty.'], columns: [], headers: [] };

  const [header, ...body] = nonEmpty;
  const headers = header.map((h) => String(h ?? '').trim()); // as written, for showing the data
  const columns = header.map(normalizeHeader);
  if (!columns.includes('name')) {
    warnings.push('No "name" column found. Cards will be named by row number.');
  }

  const cards = [];
  body.forEach((cells, idx) => {
    const rowNumber = idx + 2; // 1-based, after the header
    const fields = {};
    columns.forEach((col, c) => {
      if (!col) return;
      const value = String(cells[c] ?? '').replace(/\r\n?/g, '\n').trim();
      // A repeated column keeps the first non-empty value.
      if (fields[col] === undefined || fields[col] === '') fields[col] = value;
    });

    let count = 1;
    if (fields.count !== undefined && fields.count !== '') {
      const n = Number(fields.count);
      if (!Number.isFinite(n) || n < 0) {
        warnings.push(`Row ${rowNumber}: count "${fields.count}" isn't a number; using 1.`);
      } else {
        count = Math.floor(n);
      }
    }
    if (count === 0) return; // count 0 = leave the card out

    const name = fields.name || `Card ${rowNumber}`;
    if (!fields.name) warnings.push(`Row ${rowNumber}: no name; called it "${name}".`);

    cards.push({
      id: `r${rowNumber}`,
      row: rowNumber,
      name,
      count,
      deck: fields.deck || 'Deck',
      layout: (fields.layout || '').toLowerCase(),
      art: fields.art || '',
      fields: { ...fields, name },
    });
  });

  if (!cards.length && !warnings.length) warnings.push('No cards found under the header row.');
  return { cards, warnings, columns, headers };
}

export function groupByDeck(cards) {
  const decks = new Map();
  for (const card of cards) {
    if (!decks.has(card.deck)) decks.set(card.deck, []);
    decks.get(card.deck).push(card);
  }
  return [...decks].map(([name, deckCards]) => ({ name, cards: deckCards }));
}
