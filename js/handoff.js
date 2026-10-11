// Cards sent from another site in the page's link: card-builder/#import=<data>.
// The data never reaches a server (browsers don't send the part after "#").
//
// <data> is base64url of deflate-raw-compressed UTF-8 JSON:
//   { "v": 1, "title": "Aria's cards", "layout": "flagonquest",
//     "columns": ["name", "count", "deck", ...], "rows": [["Brace", 1, "Aria: Techniques", ...], ...] }
// title and layout are optional. Cells may be strings or numbers. Columns use the
// same names (or header aliases) as a spreadsheet's header row.
//
// Pure apart from CompressionStream/DecompressionStream, which browsers and Node 18+ have.

export const HANDOFF_KEY = 'import';
export const HANDOFF_VERSION = 1;
const MAX_BYTES = 4 * 1024 * 1024; // decompressed; far more than any character needs

function toBase64Url(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text) {
  const b64 = text.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function pipe(bytes, stream) {
  const out = new Response(new Blob([bytes]).stream().pipeThrough(stream));
  return new Uint8Array(await out.arrayBuffer());
}

// The link fragment for a payload (what the sending site builds; also used by tests).
export async function encodeHandoff(payload) {
  const json = new TextEncoder().encode(JSON.stringify({ v: HANDOFF_VERSION, ...payload }));
  return `#${HANDOFF_KEY}=${toBase64Url(await pipe(json, new CompressionStream('deflate-raw')))}`;
}

// The data part of a location hash, or null when the hash isn't a handoff.
export function handoffData(hash) {
  const match = /^#?import=([A-Za-z0-9_-]+)$/.exec(String(hash || ''));
  return match ? match[1] : null;
}

// Returns { title, layout, rows } with rows[0] the header row, ready for rowsToCards.
// Throws an Error with a readable message when the data is damaged or not ours.
export async function decodeHandoff(data) {
  let payload;
  try {
    const bytes = await pipe(fromBase64Url(data), new DecompressionStream('deflate-raw'));
    if (bytes.length > MAX_BYTES) throw new Error('too large');
    payload = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new Error('The cards in this link are damaged or incomplete. Try sending them again.');
  }
  if (payload?.v !== HANDOFF_VERSION) {
    throw new Error('These cards came from a newer version of the sending site. Reload Card Builder and try again.');
  }
  const { columns, rows } = payload;
  const cell = (v) => (v == null ? '' : String(v));
  if (!Array.isArray(columns) || !columns.length || !Array.isArray(rows) || rows.some((r) => !Array.isArray(r))) {
    throw new Error('The cards in this link are damaged or incomplete. Try sending them again.');
  }
  return {
    title: typeof payload.title === 'string' ? payload.title.slice(0, 120) : '',
    layout: typeof payload.layout === 'string' ? payload.layout : '',
    rows: [columns.map(cell), ...rows.map((r) => r.map(cell))],
  };
}
