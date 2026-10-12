// Weighted color blends for card backgrounds: "Instinct 2, Knowledge 1" → a field
// where each color covers its share of the area, drawn as a gradient, hard split,
// tie-dye spiral, marble or solid. The layout supplies what the words mean (which
// word is which color, which words change a color); this module knows no game terms.
// Parsing and the area math are pure (Node-tested); painting needs a canvas.
import { splitList } from './richtext.js';

export const BLEND_STYLES = ['gradient', 'split', 'tie-dye', 'marble', 'solid'];

// value: a list cell like "Instinct 2, Inverted Passion".
// colors: { word: color } (case-insensitive); modifiers: { word: { mix, amount } }.
// Each item needs one color word; a number in it is its weight (default 1); any
// modifier words in it change that part's color. Returns [{ key, weight, color, modifiers }].
export function parseBlend(value, colors, modifiers = {}) {
  const colorKeys = Object.keys(colors).map((k) => k.toLowerCase());
  const modKeys = Object.keys(modifiers).map((k) => k.toLowerCase());
  const out = [];
  for (const item of splitList(value)) {
    const words = item.toLowerCase().match(/[a-z]+|\d+(\.\d+)?/g) || [];
    const key = words.find((w) => colorKeys.includes(w));
    if (!key) continue;
    const num = words.find((w) => /^\d/.test(w));
    const weight = num ? Number(num) : 1;
    if (!(weight > 0)) continue;
    const mods = words.filter((w) => modKeys.includes(w));
    out.push({ key, weight, color: lookup(colors, key), modifiers: mods });
  }
  return out;
}

const lookup = (obj, key) => Object.entries(obj).find(([k]) => k.toLowerCase() === key)?.[1];

export function hexToRgb(hex) {
  const h = String(hex).replace('#', '');
  const full = h.length === 3 ? [...h].map((c) => c + c).join('') : h;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) || 0);
}

// A part's final color: its base color, mixed toward each modifier's color.
export function partRgb(part, modifiers = {}) {
  let rgb = hexToRgb(part.color);
  for (const m of part.modifiers) {
    const mod = lookup(modifiers, m);
    if (!mod) continue;
    const to = hexToRgb(mod.mix);
    const t = mod.amount ?? 0.6;
    rgb = rgb.map((v, i) => Math.round(v + (to[i] - v) * t));
  }
  return rgb;
}

// Thresholds that split a field of values so each part covers its share of the
// area: sorted values, cut at the cumulative weights.
export function quantileThresholds(values, weights) {
  const sorted = Float32Array.from(values).sort();
  const total = weights.reduce((s, w) => s + w, 0);
  let acc = 0;
  return weights.map((w) => {
    acc += w / total;
    return sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor(acc * sorted.length) - 1))];
  });
}

// ---- Seeded noise, so a card always gets the same pattern (seeded by its name) ----

export function hashSeed(text) {
  let h = 2166136261;
  for (const ch of String(text)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}

function makeNoise(seed) {
  let s = seed >>> 0;
  const rnd = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
  const N = 64;
  const grid = new Float32Array(N * N).map(() => rnd());
  const at = (x, y) => grid[(((y % N) + N) % N) * N + (((x % N) + N) % N)];
  const smooth = (t) => t * t * (3 - 2 * t);
  return (x, y) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = smooth(x - xi);
    const yf = smooth(y - yi);
    const a = at(xi, yi);
    const b = at(xi + 1, yi);
    const c = at(xi, yi + 1);
    const d = at(xi + 1, yi + 1);
    return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf;
  };
}

function fbm(noise, x, y) {
  let v = 0;
  let amp = 0.5;
  let f = 1;
  for (let o = 0; o < 4; o++) {
    v += amp * noise(x * f, y * f);
    amp /= 2;
    f *= 2;
  }
  return v / 0.9375;
}

// Each style is a value field over the card (u, v in 0..1, aspect = height/width);
// colors are then assigned by area. `soft` is the blend width between neighbors.
const FIELDS = {
  gradient: { soft: 0.12, make: () => (u, v) => u * 0.45 + v * 0.55 },
  split: { soft: 0.006, make: () => (u, v) => u * 0.35 + v * 0.65 },
  'tie-dye': {
    soft: 0.05,
    make: (seed, aspect) => {
      const n = makeNoise(seed);
      return (u, v) => {
        const dx = u - 0.5;
        const dy = (v - 0.5) * aspect;
        const t = (Math.atan2(dy, dx) / (2 * Math.PI)) * 3 + Math.hypot(dx, dy) * 3.2 + fbm(n, u * 10, v * 10 * aspect) * 0.45;
        return t - Math.floor(t);
      };
    },
  },
  marble: {
    soft: 0.03,
    make: (seed, aspect) => {
      const n = makeNoise(seed);
      const warp = makeNoise(seed + 7);
      return (u, v) => {
        const x = u * 4;
        const y = v * 4 * aspect;
        const wx = fbm(warp, x, y) * 4;
        const wy = fbm(warp, x + 5, y + 9) * 4;
        return fbm(n, x + wx, y + wy);
      };
    },
  },
};

// Paints the blend into a w×h ImageData-like buffer (Uint8ClampedArray, RGBA).
// parts: from parseBlend; rgb: each part's color. Pure apart from the buffer.
export function paintBlend(data, w, h, { parts, rgb, style = 'gradient', seed = 1 }) {
  if (!parts.length) return;
  const fill = (c) => {
    for (let i = 0; i < w * h; i++) data.set([c[0], c[1], c[2], 255], i * 4);
  };
  if (style === 'solid' || parts.length === 1) {
    // The strongest part (the first one listed, on a tie).
    let best = 0;
    parts.forEach((p, i) => p.weight > parts[best].weight && (best = i));
    fill(rgb[best]);
    return;
  }
  const spec = FIELDS[style] || FIELDS.gradient;
  const field = spec.make(seed, h / w);
  const values = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) values[y * w + x] = field(x / w, y / h);
  const th = quantileThresholds(values, parts.map((p) => p.weight));
  const soft = spec.soft;
  const last = parts.length - 1;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    let k = th.findIndex((t) => v <= t);
    if (k < 0) k = last;
    let c = rgb[k];
    // Soften the edge toward the neighboring part.
    if (k < last && th[k] - v < soft) c = mixRgb(c, rgb[k + 1], 0.5 - (th[k] - v) / soft / 2);
    else if (k > 0 && v - th[k - 1] < soft) c = mixRgb(c, rgb[k - 1], 0.5 - (v - th[k - 1]) / soft / 2);
    data[i * 4] = c[0];
    data[i * 4 + 1] = c[1];
    data[i * 4 + 2] = c[2];
    data[i * 4 + 3] = 255;
  }
}

const mixRgb = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
