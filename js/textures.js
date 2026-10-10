// Procedural surface textures for boxes, so panels look printed rather than
// flat (think of the parchment text boxes on trading cards). Generated with a
// seeded random generator, so every render of a card looks identical.
// Browser-only at call time; importing this module touches no DOM.

function mulberry32(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const TILE = 256;
const tiles = {};

// Fine grain: independent gray specks.
function grainTile() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = TILE;
  const ctx = canvas.getContext('2d');
  const data = ctx.createImageData(TILE, TILE);
  const rand = mulberry32(7);
  for (let i = 0; i < data.data.length; i += 4) {
    const v = Math.round(rand() * 255);
    data.data[i] = data.data[i + 1] = data.data[i + 2] = v;
    data.data[i + 3] = 255;
  }
  ctx.putImageData(data, 0, 0);
  return canvas;
}

// Mottle: soft blotches, from a small random grid scaled up smoothly.
function mottleTile() {
  const cells = 24;
  const small = document.createElement('canvas');
  small.width = small.height = cells;
  const sctx = small.getContext('2d');
  const data = sctx.createImageData(cells, cells);
  const rand = mulberry32(11);
  for (let i = 0; i < data.data.length; i += 4) {
    const v = Math.round(90 + rand() * 120);
    data.data[i] = data.data[i + 1] = data.data[i + 2] = v;
    data.data[i + 3] = 255;
  }
  sctx.putImageData(data, 0, 0);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = TILE;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  // Draw a 3 × 3 block and keep the middle so the tile wraps without seams.
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) ctx.drawImage(small, dx * TILE, dy * TILE, TILE, TILE);
  }
  return canvas;
}

function pattern(ctx, kind, scale) {
  tiles[kind] ||= kind === 'grain' ? grainTile() : mottleTile();
  const p = ctx.createPattern(tiles[kind], 'repeat');
  p.setTransform(new DOMMatrix().scale(scale));
  return p;
}

function overlay(ctx, kind, scale, mode, alpha, b) {
  ctx.globalCompositeOperation = mode;
  ctx.globalAlpha = alpha;
  ctx.fillStyle = pattern(ctx, kind, scale);
  ctx.fillRect(b.x, b.y, b.w, b.h);
}

// Darkens toward the edges, like aged or printed paper.
function edgeBurn(ctx, b, color, alpha) {
  const r = Math.max(b.w, b.h) * 0.75;
  const g = ctx.createRadialGradient(b.x + b.w / 2, b.y + b.h / 2, r * 0.35, b.x + b.w / 2, b.y + b.h / 2, r);
  g.addColorStop(0, 'rgba(0, 0, 0, 0)');
  g.addColorStop(1, color);
  ctx.globalCompositeOperation = 'multiply';
  ctx.globalAlpha = alpha;
  ctx.fillStyle = g;
  ctx.fillRect(b.x, b.y, b.w, b.h);
}

// Light from the top, shade at the bottom.
function sheen(ctx, b, alpha) {
  const g = ctx.createLinearGradient(0, b.y, 0, b.y + b.h);
  g.addColorStop(0, 'rgba(255, 255, 255, 0.55)');
  g.addColorStop(0.45, 'rgba(255, 255, 255, 0)');
  g.addColorStop(1, 'rgba(0, 0, 0, 0.6)');
  ctx.globalCompositeOperation = 'soft-light';
  ctx.globalAlpha = alpha;
  ctx.fillStyle = g;
  ctx.fillRect(b.x, b.y, b.w, b.h);
}

// Textures: 'paper' for light panels, 'grit' for colored or dark ones.
// strength scales the effect (1 = default). unit: pixels per 1% of card width,
// so the grain looks the same at any resolution.
export const TEXTURES = {
  paper(ctx, b, { strength, unit }) {
    overlay(ctx, 'mottle', unit * 0.5, 'multiply', 0.13 * strength, b);
    overlay(ctx, 'grain', unit * 0.25, 'multiply', 0.08 * strength, b);
    edgeBurn(ctx, b, 'rgb(150, 100, 40)', 0.4 * strength);
  },
  grit(ctx, b, { strength, unit }) {
    overlay(ctx, 'mottle', unit * 0.4, 'overlay', 0.35 * strength, b);
    overlay(ctx, 'grain', unit * 0.25, 'overlay', 0.22 * strength, b);
    sheen(ctx, b, 0.8 * strength);
  },
};

// Draws a texture inside the current path (the caller has already clipped to it).
export function applyTexture(ctx, name, b, opts) {
  const draw = TEXTURES[name];
  if (!draw) return;
  ctx.save();
  // Fold the element's own opacity into the texture strength.
  draw(ctx, b, { ...opts, strength: (opts.strength ?? 1) * ctx.globalAlpha });
  ctx.restore();
}
