// Draws cards onto canvases from a layout definition. Knows nothing about any
// particular game: layouts name the fields, this just draws them.
import { parseRich, joinParts, joinInline, splitList, affix, fitRich, textHeight, ICON_SCALE } from './richtext.js';
import { FONT_LIBRARY, DEFAULT_FONTS } from './fonts.js';

// fonts: a layout's role → { font, weight, boldWeight } map; role: e.g. 'title'.
function fontString(fonts, role, style, px) {
  const spec = fonts[role] || fonts.body || DEFAULT_FONTS.body;
  const lib = FONT_LIBRARY[spec.font] || FONT_LIBRARY.crimson;
  const weight = style.bold ? spec.boldWeight ?? spec.weight ?? 700 : spec.weight ?? 400;
  return `${style.italic ? 'italic ' : ''}${weight} ${px.toFixed(2)}px ${lib.stack}`;
}

export function layoutFonts(layout) {
  return { ...DEFAULT_FONTS, ...(layout?.fonts || {}) };
}

// ---- Images ---------------------------------------------------------------

// Uploaded images, looked up by file name (case-insensitive, extension optional).
export class AssetStore {
  constructor() {
    this.images = new Map();
    this.names = [];
  }

  static key(name) {
    return String(name || '').trim().split(/[\\/]/).pop().toLowerCase();
  }

  add(name, image) {
    const key = AssetStore.key(name);
    this.images.set(key, image);
    const stem = key.replace(/\.[^.]+$/, '');
    if (!this.images.has(stem)) this.images.set(stem, image);
    this.names.push(name);
  }

  get(name) {
    const key = AssetStore.key(name);
    if (!key) return null;
    return this.images.get(key) || this.images.get(key.replace(/\.[^.]+$/, '')) || null;
  }

  icon(name) {
    return this.get(`icon-${name}`) || this.get(name);
  }

  get size() {
    return this.names.length;
  }
}

export async function decodeImage(file) {
  return createImageBitmap(file);
}

// ---- Colors ---------------------------------------------------------------

let colorCtx;
function parseColor(value) {
  colorCtx ||= document.createElement('canvas').getContext('2d');
  const sentinel = '#010203';
  colorCtx.fillStyle = sentinel;
  colorCtx.fillStyle = String(value || '').trim();
  const out = colorCtx.fillStyle;
  if (out === sentinel && String(value).trim().toLowerCase() !== sentinel) return null;
  if (out.startsWith('#')) {
    return [1, 3, 5].map((i) => parseInt(out.slice(i, i + 2), 16));
  }
  const m = out.match(/[\d.]+/g);
  return m ? m.slice(0, 3).map(Number) : null;
}

const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
const rgb = (c) => `rgb(${c.join(', ')})`;

export function makeTheme(color, fallback = '#8a5a2b') {
  const base = parseColor(color) || parseColor(fallback);
  const luminance = 0.299 * base[0] + 0.587 * base[1] + 0.114 * base[2];
  return {
    accent: rgb(base),
    onAccent: luminance > 150 ? '#141414' : '#ffffff', // readable text on an accent fill
    accentDark: rgb(mix(base, [0, 0, 0], 0.45)),
    accentLight: rgb(mix(base, [255, 255, 255], 0.55)),
    ink: '#231a12',
    paper: '#f2e8d5',
    paperLight: '#faf5ea',
  };
}

// ---- Drawing helpers ----------------------------------------------------

function roundRectPath(ctx, x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawCover(ctx, image, x, y, w, h) {
  const scale = Math.max(w / image.width, h / image.height);
  const sw = w / scale;
  const sh = h / scale;
  ctx.drawImage(image, (image.width - sw) / 2, (image.height - sh) / 2, sw, sh, x, y, w, h);
}

function fieldValue(card, field) {
  return String(card.fields[field] ?? '').trim();
}

// `when`/`unless` name one field or a list of fields; a list matches if any field has a value.
function anyValue(card, fields) {
  return [].concat(fields).some((f) => fieldValue(card, f));
}

// ---- Card rendering -----------------------------------------------------

// card: { name, art, fields }, layout: see layouts/, px: { width, height }
export function renderCard(card, { layout, px, assets, canvas }) {
  canvas ||= document.createElement('canvas');
  canvas.width = px.width;
  canvas.height = px.height;
  const ctx = canvas.getContext('2d');
  const theme = makeTheme(card.fields.color, layout.defaultColor);
  const fonts = layoutFonts(layout);
  const W = px.width;
  const H = px.height;
  const box = (el) => ({ x: (el.x / 100) * W, y: (el.y / 100) * H, w: (el.w / 100) * W, h: (el.h / 100) * H });
  const s = (v) => (v / 100) * W;
  const color = (c) => theme[c] || c;

  for (const el of layout.elements) {
    if (el.when && !anyValue(card, el.when)) continue;
    if (el.unless && anyValue(card, el.unless)) continue;
    const b = box(el);
    ctx.save();
    if (el.opacity != null) ctx.globalAlpha = el.opacity;
    if (el.rotate) {
      const cx = b.x + b.w / 2;
      const cy = b.y + b.h / 2;
      ctx.translate(cx, cy);
      ctx.rotate((el.rotate * Math.PI) / 180);
      ctx.translate(-cx, -cy);
    }

    if (el.type === 'rect') {
      roundRectPath(ctx, b.x, b.y, b.w, b.h, s(el.radius || 0));
      if (el.fill) {
        ctx.fillStyle = color(el.fill);
        ctx.fill();
      }
      if (el.stroke) {
        ctx.strokeStyle = color(el.stroke);
        ctx.lineWidth = s(el.strokeWidth || 0.3);
        ctx.stroke();
      }
    } else if (el.type === 'image') {
      drawImageElement(ctx, card, el, b, { assets, theme, s, color, fonts });
    } else if (el.type === 'text') {
      drawTextElement(ctx, card, el, b, { assets, s, color, fonts });
    }
    ctx.restore();
  }
  return canvas;
}

function drawImageElement(ctx, card, el, b, { assets, theme, s, color, fonts }) {
  const name = fieldValue(card, el.field || 'art');
  const image = assets?.get(name);
  ctx.save();
  roundRectPath(ctx, b.x, b.y, b.w, b.h, s(el.radius || 0));
  ctx.clip();
  if (image) {
    drawCover(ctx, image, b.x, b.y, b.w, b.h);
  } else {
    // Placeholder: accent gradient + a big initial, plus the missing file name.
    const g = ctx.createLinearGradient(b.x, b.y, b.x + b.w, b.y + b.h);
    g.addColorStop(0, theme.accentLight);
    g.addColorStop(1, theme.accentDark);
    ctx.fillStyle = g;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    const big = Math.min(b.w, b.h) * 0.45;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.font = fontString(fonts, 'title', {}, big);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText((card.name || '?').trim().charAt(0).toUpperCase(), b.x + b.w / 2, b.y + b.h / 2);
    if (name) {
      ctx.font = fontString(fonts, 'body', {}, s(3.4));
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.fillText(`missing art: ${name}`, b.x + b.w / 2, b.y + b.h * 0.88, b.w * 0.9);
    }
  }
  ctx.restore();
  if (el.stroke) {
    roundRectPath(ctx, b.x, b.y, b.w, b.h, s(el.radius || 0));
    ctx.strokeStyle = color(el.stroke);
    ctx.lineWidth = s(el.strokeWidth || 0.3);
    ctx.stroke();
  }
}

// One field's text. entry: 'field' or { field, bold, italic, color, prefix, suffix, list, listSep }.
// list: the cell holds comma-separated items, shown joined with listSep.
function entryAtoms(card, entry, base) {
  const e = typeof entry === 'string' ? { field: entry } : entry;
  const style = { bold: e.bold ?? base.bold, italic: e.italic ?? base.italic, color: e.color ?? base.color };
  const value = fieldValue(card, e.field);
  if (!value) return [];
  if (e.list) {
    const items = splitList(value).map((item) => parseRich(affix(item, e), style));
    return joinInline(items, e.listSep ?? ' · ', style);
  }
  return parseRich(affix(value, e), style);
}

function textAtoms(card, el) {
  const base = { bold: el.weight === 'bold', italic: !!el.italic };
  if (el.text != null) return parseRich(el.text, base); // fixed text, e.g. a label
  if (el.parts) return joinParts(el.parts.map((p) => entryAtoms(card, p, base)));
  if (el.join) {
    const sepStyle = { ...base, color: el.sepColor };
    return joinInline(el.join.map((p) => entryAtoms(card, p, base)), el.sep ?? ' ', sepStyle);
  }
  return entryAtoms(card, el, base);
}

// shadow: true (soft glow) or { color, x, y, blur } with offsets in ems of the font size.
function applyShadow(ctx, shadow, size, color) {
  if (!shadow) return;
  const sh = shadow === true ? { color: 'rgba(0, 0, 0, 0.75)', x: 0, y: 0.04, blur: 0.18 } : shadow;
  ctx.shadowColor = color(sh.color || '#000');
  ctx.shadowOffsetX = (sh.x || 0) * size;
  ctx.shadowOffsetY = (sh.y || 0) * size;
  ctx.shadowBlur = (sh.blur || 0) * size;
}

function drawTextElement(ctx, card, el, b, { assets, s, color, fonts }) {
  const atoms = textAtoms(card, el);
  if (!atoms.length) return;

  const cache = new Map();
  const measure = (text, style, px) => {
    const font = fontString(fonts, el.font, style, px);
    const key = `${font}|${text}`;
    if (!cache.has(key)) {
      ctx.font = font;
      cache.set(key, ctx.measureText(text).width);
    }
    return cache.get(key);
  };

  const lineHeight = el.lineHeight ?? 1.15;
  const fit = fitRich(atoms, {
    boxWidth: b.w,
    boxHeight: b.h,
    maxSize: s(el.size),
    minSize: s(el.minSize ?? el.size),
    lineHeight,
    measure,
    shrink: el.shrink !== false,
  });

  const size = fit.size;
  const lineH = size * lineHeight;
  const total = textHeight(fit.lines, size, lineHeight);
  let top = b.y;
  if (el.valign === 'middle') top = b.y + (b.h - total) / 2;
  else if (el.valign === 'bottom') top = b.y + b.h - total;

  const fill = color(el.color || 'ink');
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';

  // Position every atom first, so outlines can all be drawn before any fill.
  const placed = [];
  let y = top;
  for (const line of fit.lines) {
    y += line.gap * size;
    const center = y + lineH / 2;
    y += lineH;
    let left = b.x;
    if (el.align === 'center') left = b.x + (b.w - line.width) / 2;
    else if (el.align === 'right') left = b.x + b.w - line.width;
    for (const item of line.items) {
      placed.push({ atom: item.atom, x: left + item.x, center, baseline: center + size * (el.baseline ?? 0.32) });
    }
  }

  // Outline pass (carries the shadow), then fill pass. Without an outline the fill carries it.
  if (el.outline) {
    ctx.save();
    applyShadow(ctx, el.shadow, size, color);
    ctx.lineJoin = 'round';
    ctx.miterLimit = 2;
    ctx.lineWidth = size * (el.outlineWidth ?? 0.12) * 2;
    ctx.strokeStyle = color(el.outline);
    for (const p of placed) {
      if (p.atom.kind !== 'text') continue;
      ctx.font = fontString(fonts, el.font, p.atom, size);
      ctx.strokeText(p.atom.text, p.x, p.baseline);
    }
    ctx.restore();
  } else {
    applyShadow(ctx, el.shadow, size, color);
  }

  for (const p of placed) {
    const atomFill = p.atom.color ? color(p.atom.color) : fill;
    if (p.atom.kind === 'icon') {
      drawIcon(ctx, p.atom.name, p.x, p.center, size, atomFill, assets, fonts);
    } else {
      ctx.font = fontString(fonts, el.font, p.atom, size);
      ctx.fillStyle = atomFill;
      ctx.fillText(p.atom.text, p.x, p.baseline);
    }
  }
}

function drawIcon(ctx, name, x, center, size, fill, assets, fonts) {
  const d = size * ICON_SCALE * 0.92;
  const cx = x + (size * ICON_SCALE) / 2;
  const image = assets?.icon(name);
  if (image) {
    const scale = Math.min(d / image.width, d / image.height);
    const w = image.width * scale;
    const h = image.height * scale;
    ctx.drawImage(image, cx - w / 2, center - h / 2, w, h);
    return;
  }
  // No icon image uploaded: a ringed initial so the text still reads.
  ctx.save();
  ctx.shadowColor = 'transparent';
  ctx.beginPath();
  ctx.arc(cx, center, d / 2, 0, Math.PI * 2);
  ctx.strokeStyle = fill;
  ctx.lineWidth = Math.max(1, size * 0.07);
  ctx.stroke();
  ctx.fillStyle = fill;
  ctx.font = fontString(fonts, 'title', {}, d * 0.6);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(name.charAt(0).toUpperCase(), cx, center + d * 0.04);
  ctx.restore();
}

// ---- Card backs -------------------------------------------------------------

export function renderBack({ image, px, title, color }) {
  const canvas = document.createElement('canvas');
  canvas.width = px.width;
  canvas.height = px.height;
  const ctx = canvas.getContext('2d');
  const W = px.width;
  const H = px.height;

  if (image) {
    drawCover(ctx, image, 0, 0, W, H);
    return canvas;
  }

  // Generated default back: diamond lattice in the deck color with the deck name.
  const theme = makeTheme(color, '#5a3a22');
  ctx.fillStyle = theme.accentDark;
  ctx.fillRect(0, 0, W, H);
  const inset = W * 0.05;
  ctx.save();
  roundRectPath(ctx, inset, inset, W - inset * 2, H - inset * 2, W * 0.03);
  ctx.clip();
  ctx.fillStyle = theme.accent;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = theme.accentDark;
  ctx.lineWidth = W * 0.006;
  const step = W * 0.09;
  for (let d = -H; d < W + H; d += step) {
    ctx.beginPath();
    ctx.moveTo(d, 0);
    ctx.lineTo(d + H, H);
    ctx.moveTo(d, H);
    ctx.lineTo(d + H, 0);
    ctx.stroke();
  }
  ctx.restore();
  roundRectPath(ctx, inset, inset, W - inset * 2, H - inset * 2, W * 0.03);
  ctx.strokeStyle = theme.accentLight;
  ctx.lineWidth = W * 0.008;
  ctx.stroke();

  const ovalW = W * 0.62;
  const ovalH = H * 0.2;
  ctx.beginPath();
  ctx.ellipse(W / 2, H / 2, ovalW / 2, ovalH / 2, 0, 0, Math.PI * 2);
  ctx.fillStyle = theme.accentDark;
  ctx.fill();
  ctx.strokeStyle = theme.accentLight;
  ctx.stroke();

  const label = String(title || '').trim();
  if (label) {
    let size = W * 0.075;
    ctx.font = fontString(DEFAULT_FONTS, 'title', {}, size);
    const max = ovalW * 0.8;
    const width = ctx.measureText(label).width;
    if (width > max) size *= max / width;
    ctx.font = fontString(DEFAULT_FONTS, 'title', {}, size);
    ctx.fillStyle = theme.paper;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, W / 2, H / 2 + size * 0.05);
  }
  return canvas;
}

// ---- Output helpers ---------------------------------------------------------

export function scaleCanvas(source, width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, 0, 0, width, height);
  return canvas;
}

export function canvasToBlob(canvas, type = 'image/png', quality) {
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not encode image.'))), type, quality),
  );
}
