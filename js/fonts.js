// Fonts available to layouts. A layout picks fonts by key in its `fonts` map
// (see layouts/street.js). To add a font: add an entry here with its Google
// Fonts family spec and the faces to preload; canvas only draws loaded fonts.
export const FONT_LIBRARY = {
  cinzel: {
    stack: '"Cinzel", Georgia, serif',
    google: 'Cinzel:wght@700',
    faces: ['700'],
  },
  crimson: {
    stack: '"Crimson Pro", Georgia, serif',
    google: 'Crimson+Pro:ital,wght@0,400;0,700;1,400;1,700',
    faces: ['400', '700', 'italic 400', 'italic 700'],
  },
  sedgwick: {
    stack: '"Sedgwick Ave Display", "Permanent Marker", Impact, sans-serif',
    google: 'Sedgwick+Ave+Display',
    faces: ['400'],
  },
  'permanent-marker': {
    stack: '"Permanent Marker", Impact, sans-serif',
    google: 'Permanent+Marker',
    faces: ['400'],
  },
  bebas: {
    stack: '"Bebas Neue", Impact, "Arial Narrow", sans-serif',
    google: 'Bebas+Neue',
    faces: ['400'],
  },
  barlow: {
    stack: '"Barlow", Arial, sans-serif',
    google: 'Barlow:ital,wght@0,500;0,700;1,500;1,700',
    faces: ['500', '700', 'italic 500', 'italic 700'],
  },
};

// Font roles used by layouts that don't declare their own.
export const DEFAULT_FONTS = {
  title: { font: 'cinzel', weight: 700 },
  body: { font: 'crimson', weight: 400, boldWeight: 700 },
};

function familyName(stack) {
  return stack.split(',')[0].trim();
}

export function googleFontsUrl() {
  const families = Object.values(FONT_LIBRARY).map((f) => `family=${f.google}`);
  return `https://fonts.googleapis.com/css2?${families.join('&')}&display=block`;
}

// Loads every library font. Resolves after at most `timeoutMs` so a blocked
// font server only costs a short wait (text then falls back to the next font in the stack).
export async function loadFonts(timeoutMs = 5000) {
  if (typeof document === 'undefined' || !document.fonts) return;
  if (!document.querySelector('link[data-card-fonts]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = googleFontsUrl();
    link.dataset.cardFonts = 'true';
    const loaded = new Promise((resolve) => {
      link.onload = resolve;
      link.onerror = resolve;
    });
    document.head.append(link);
    await Promise.race([loaded, new Promise((r) => setTimeout(r, timeoutMs))]);
  }
  const specs = Object.values(FONT_LIBRARY).flatMap((f) =>
    f.faces.map((face) => `${face} 40px ${familyName(f.stack)}`),
  );
  const timeout = new Promise((resolve) => setTimeout(resolve, timeoutMs));
  await Promise.race([Promise.allSettled(specs.map((s) => document.fonts.load(s))), timeout]);
}
