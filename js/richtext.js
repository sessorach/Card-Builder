// Card text markup and word wrapping. Pure logic: measuring is injected so this
// runs (and is tested) without a canvas.
//
// Markup supported in any text cell:
//   **bold**   *italic*   {icon}   line breaks (Alt+Enter in the sheet, or a literal \n)
//   A backslash escapes the next * { } or \ character.

// Atoms: { kind: 'text', text, bold, italic, space }
//        { kind: 'icon', name, bold, italic, space }
//        { kind: 'break', gap? }   gap: extra space above the next line, in ems
// `space` means whitespace came before the atom, i.e. the line may wrap there.
export function parseRich(input, base = {}) {
  const str = String(input ?? '').replace(/\\n/g, '\n');
  const atoms = [];
  let bold = !!base.bold;
  let italic = !!base.italic;
  let word = '';
  let space = false;

  const flush = () => {
    if (word) atoms.push({ kind: 'text', text: word, bold, italic, space });
    if (word) space = false;
    word = '';
  };

  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (ch === '\\' && '*{}\\'.includes(str[i + 1] ?? '')) {
      word += str[++i];
    } else if (ch === '\n') {
      flush();
      atoms.push({ kind: 'break' });
      space = false;
    } else if (/\s/.test(ch)) {
      flush();
      space = true;
    } else if (ch === '*' && str[i + 1] === '*') {
      flush();
      bold = !bold;
      i++;
    } else if (ch === '*') {
      flush();
      italic = !italic;
    } else if (ch === '{') {
      const end = str.indexOf('}', i);
      const name = end > i ? str.slice(i + 1, end).trim() : '';
      if (/^[\w-]+$/.test(name)) {
        flush();
        atoms.push({ kind: 'icon', name: name.toLowerCase(), bold, italic, space });
        space = false;
        i = end;
      } else {
        word += ch;
      }
    } else {
      word += ch;
    }
  }
  flush();
  return atoms;
}

// Joins several parsed parts with paragraph breaks (e.g. rules text + italic flavor).
export const PARAGRAPH_GAP = 0.4;
export function joinParts(parts) {
  const atoms = [];
  for (const part of parts) {
    if (!part.length) continue;
    if (atoms.length) atoms.push({ kind: 'break', gap: PARAGRAPH_GAP });
    atoms.push(...part);
  }
  return atoms;
}

export const ICON_SCALE = 1.0; // icon width as a multiple of the font size

function atomWidth(atom, size, measure) {
  if (atom.kind === 'icon') return size * ICON_SCALE;
  return measure(atom.text, atom, size);
}

// Greedy word wrap.
// Returns { lines: [{ items: [{ atom, x, width }], width, gap }], width }, where
// gap is extra space above the line in ems (paragraph spacing).
export function layoutRich(atoms, { maxWidth, size, measure }) {
  const lines = [];
  let line = { items: [], width: 0, gap: 0 };
  const newLine = (gap = 0) => {
    lines.push(line);
    line = { items: [], width: 0, gap };
  };

  // Group atoms into unbreakable words.
  const words = [];
  for (const atom of atoms) {
    if (atom.kind === 'break') {
      words.push(atom);
    } else if (atom.space || !words.length || !Array.isArray(words[words.length - 1])) {
      words.push([atom]);
    } else {
      words[words.length - 1].push(atom);
    }
  }

  for (const w of words) {
    if (!Array.isArray(w)) {
      newLine(w.gap || 0);
      continue;
    }
    const widths = w.map((a) => atomWidth(a, size, measure));
    const wordWidth = widths.reduce((s, x) => s + x, 0);
    const gap = line.items.length ? measure(' ', w[0], size) : 0;
    if (line.items.length && line.width + gap + wordWidth > maxWidth) newLine();
    let x = line.width + (line.items.length ? gap : 0);
    w.forEach((atom, i) => {
      line.items.push({ atom, x, width: widths[i] });
      x += widths[i];
    });
    line.width = x;
  }
  newLine();

  return { lines, width: Math.max(0, ...lines.map((l) => l.width)) };
}

export function textHeight(lines, size, lineHeight) {
  return lines.reduce((h, line) => h + size * (lineHeight + line.gap), 0);
}

// Largest font size (between minSize and maxSize) at which the text fits the box.
export function fitRich(atoms, { boxWidth, boxHeight, maxSize, minSize, lineHeight, measure, shrink = true }) {
  const tryAt = (size) => {
    const result = layoutRich(atoms, { maxWidth: boxWidth, size, measure });
    const height = textHeight(result.lines, size, lineHeight);
    return { ...result, size, height, fits: result.width <= boxWidth + 0.5 && height <= boxHeight + 0.5 };
  };

  const best = tryAt(maxSize);
  if (best.fits || !shrink) return best;

  let lo = minSize;
  let hi = maxSize;
  let found = tryAt(minSize);
  if (!found.fits) return found; // overflows even at the minimum size
  while (hi - lo > 0.25) {
    const mid = (lo + hi) / 2;
    const attempt = tryAt(mid);
    if (attempt.fits) {
      found = attempt;
      lo = mid;
    } else {
      hi = mid;
    }
  }
  return found;
}

// Plain text for Tabletop Simulator descriptions, which understand [b] and [i].
export function toTtsText(input) {
  return String(input ?? '')
    .replace(/\\n/g, '\n')
    .replace(/\*\*(.+?)\*\*/gs, '[b]$1[/b]')
    .replace(/\*(.+?)\*/gs, '[i]$1[/i]')
    .replace(/\\([*{}\\])/g, '$1');
}
