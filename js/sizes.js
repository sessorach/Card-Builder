// Physical card sizes. Layouts are positioned in percentages of the card, so
// adding a size here is all it takes to offer it in the size selector.
export const CARD_SIZES = [
  { id: 'poker', label: 'Poker (63 × 88 mm)', widthMm: 63, heightMm: 88 },
];

export const DEFAULT_SIZE_ID = 'poker';

// Cards are rendered at print resolution; TTS sheets are scaled down from this
// when a sheet would otherwise be too large.
export const DPI = 300;

export function getSize(id) {
  return CARD_SIZES.find((s) => s.id === id) || CARD_SIZES[0];
}

export function sizePx(size, dpi = DPI) {
  return {
    width: Math.round((size.widthMm / 25.4) * dpi),
    height: Math.round((size.heightMm / 25.4) * dpi),
  };
}
