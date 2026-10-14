// The Card maker tab: boxes for the chosen look's columns, a live preview of the
// card, and the cards saved so far, which become a spreadsheet. The work in
// progress is kept in this browser per look (localStorage), so it survives a reload.
// The pure parts live in js/maker.js.

import { formFields, visibleFields, blendRows, blendText, rowsToCsv, fieldLabel } from './maker.js';
import { columnHelp } from './columns.js';
import { templateColumns } from './template.js';
import { renderCard, AssetStore } from './render.js';
import { BLEND_STYLES } from './blend.js';

const KEY = 'card-builder:maker:';
const $ = (id) => document.getElementById(id);
const el = (tag, props = {}, ...children) => {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children.filter((c) => c != null));
  return node;
};
const looseName = (file) => AssetStore.loose(String(file).replace(/\.[^.]+$/, ''));
// Kept from one card to the next, since a run of cards usually shares them.
const CARRY = ['deck', 'type'];

// deps: { layout() → the chosen layout, assets() → the pictures loaded so far,
//   addPicture(file) → adds a picture, download(blob, name),
//   showCards(csv, name, { keepTab }) → puts the maker's cards in the Cards tab,
//   linked() → whether the cards on show are the maker's (so saves go there too),
//   loadedRows() → [{ column: value }] for the cards on show }
export function setupMaker(deps) {
  let layout = null;
  let fields = [];
  let switches = new Set(); // columns that show or hide other boxes
  // rows: the saved cards; current: the card in the boxes; editing: its place in rows
  // (null for a new card); source: the spreadsheet the rows came from, if any.
  let work = { rows: [], current: {}, editing: null, source: '' };

  const load = (id) => {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY + id) || 'null');
      if (saved && Array.isArray(saved.rows)) return { rows: saved.rows, current: saved.current || {}, editing: saved.editing ?? null, source: saved.source || '' };
    } catch {
      // private window or damaged data: start empty
    }
    return { rows: [], current: {}, editing: null, source: '' };
  };
  const save = () => {
    try {
      localStorage.setItem(KEY + layout.id, JSON.stringify(work));
    } catch {
      // storage full or blocked: the cards still work until the page closes
    }
  };

  // Every column the saved cards use: the look's, in its order, then art when a card
  // has a picture, then any other columns a loaded spreadsheet brought (an ID or notes
  // column), so editing a spreadsheet here never drops them.
  const columns = () => {
    const cols = templateColumns(layout);
    if ([...work.rows, work.current].some((r) => r.art)) cols.push('art');
    for (const row of work.rows) for (const c of Object.keys(row)) if (!cols.includes(c)) cols.push(c);
    return cols;
  };
  const sheetName = () => (work.source ? `${work.source} (edited)` : 'Card maker cards');
  const csv = () => rowsToCsv(columns(), work.rows);
  // After any change to the saved cards: keep them, redraw the list, and when the Cards
  // tab is showing them, update it too.
  const changed = () => {
    save();
    updateButtons();
    if (deps.linked()) deps.showCards(csv(), sheetName(), { keepTab: true });
  };
  // The card as the spreadsheet would give it (built directly, so a card with no
  // name yet is drawn without one rather than as "Card 2").
  const cardOf = (row) => {
    const fields = {};
    for (const c of columns()) fields[c] = String(row[c] ?? '').replace(/\r\n?/g, '\n').trim();
    return { id: 'maker', row: 1, name: fields.name, count: 1, deck: fields.deck || 'Deck', layout: '', art: fields.art || '', fields };
  };

  // ---- The boxes ----

  function buildForm() {
    const form = $('maker-fields');
    form.replaceChildren();
    for (const field of fields) form.append(fieldBox(field));
    fillForm();
  }

  function fieldBox(field) {
    const { column, kind } = field;
    const id = `mk-field-${column}`; // own prefix: "maker-count" is the saved-card counter
    const box = el('div', { className: `mk-field mk-kind-${kind}` });
    box.dataset.column = column;
    box.append(el('label', { htmlFor: id, textContent: fieldLabel(column) }));
    let input;
    if (kind === 'blend') {
      box.append(blendPicker(field));
      box.append(el('p', { className: 'mk-help', textContent: blendHelp(field) }));
      return box;
    }
    if (kind === 'long') {
      input = el('textarea', { id, rows: column === 'text' ? 4 : 2 });
    } else if (kind === 'style') {
      input = el('select', { id });
      input.add(new Option('gradient (the default)', ''));
      for (const style of BLEND_STYLES.filter((s) => s !== 'gradient')) input.add(new Option(style, style));
    } else if (kind === 'color') {
      input = colorBox(id, column);
      box.append(input);
      const help = columnHelp(column, layout.id);
      if (help) box.append(el('p', { className: 'mk-help', textContent: help }));
      return box;
    } else if (field.choices?.length) {
      input = el('select', { id });
      input.add(new Option('(choose)', ''));
      for (const choice of field.choices) input.add(new Option(choice, choice));
    } else {
      input = el('input', { id, type: column === 'count' ? 'number' : 'text', autocomplete: 'off' });
      if (column === 'count') Object.assign(input, { min: 0, placeholder: '1' });
      if (kind === 'list') input.placeholder = 'Separate with commas';
      if (field.options?.length) {
        const list = el('datalist', { id: `${id}-options` });
        for (const option of field.options) list.append(el('option', { value: option }));
        box.append(list);
        input.setAttribute('list', list.id);
        input.placeholder = field.options.join(' or ');
      }
    }
    input.dataset.column = column;
    input.addEventListener('input', () => change(column, input.value));
    box.append(input);
    const help = columnHelp(column, layout.id);
    if (help) box.append(el('p', { className: 'mk-help', textContent: help }));
    return box;
  }

  // A color: type a name or hex code, or pick one; the swatch follows what's typed.
  function colorBox(id, column) {
    const text = el('input', { id, type: 'text', autocomplete: 'off', placeholder: 'e.g. crimson or #3b5b7a' });
    const pick = el('input', { type: 'color', title: 'Pick a color' });
    const clear = el('button', { type: 'button', className: 'mini', textContent: 'Clear' });
    const wrap = el('div', { className: 'mk-color' }, pick, text, clear);
    wrap.dataset.column = column;
    const probe = document.createElement('canvas').getContext('2d');
    const sync = () => {
      probe.fillStyle = '#000000';
      probe.fillStyle = text.value.trim() || '#000000';
      if (/^#[0-9a-f]{6}$/i.test(probe.fillStyle)) pick.value = probe.fillStyle;
      wrap.classList.toggle('empty', !text.value.trim());
    };
    text.addEventListener('input', () => {
      sync();
      change(column, text.value);
    });
    pick.addEventListener('input', () => {
      text.value = pick.value;
      sync();
      change(column, pick.value);
    });
    clear.addEventListener('click', () => {
      text.value = '';
      sync();
      change(column, '');
    });
    wrap.fill = (value) => {
      text.value = value;
      sync();
    };
    return wrap;
  }

  const blendHelp = (field) => {
    const mods = Object.keys(field.modifiers).map((m) => m[0].toUpperCase() + m.slice(1));
    return `Add a row for each color. A bigger number gives that color more of the card: 2 and 1 makes it two-thirds the first color.${mods.length ? ` Tick ${mods.join(' or ')} to change that share.` : ''}`;
  };

  // Weighted colors as rows: [color ▾] [number] [Inverted] [×], then "Add a color".
  function blendPicker(field) {
    const wrap = el('div', { className: 'mk-blend' });
    wrap.dataset.column = field.column;
    const colors = Object.keys(field.colors).map((c) => c[0].toUpperCase() + c.slice(1));
    const mods = Object.keys(field.modifiers).map((m) => m[0].toUpperCase() + m.slice(1));
    const rows = el('div', { className: 'mk-blend-rows' });
    const result = el('p', { className: 'mk-blend-result' });
    const write = () => {
      const picked = [...rows.children].map((row) => ({
        color: row.querySelector('select').value,
        weight: Number(row.querySelector('input[type=number]').value) || 0,
        modifiers: [...row.querySelectorAll('input[type=checkbox]')].filter((c) => c.checked).map((c) => c.value),
      }));
      const text = blendText(picked);
      result.replaceChildren('In the spreadsheet: ', text ? el('code', { textContent: text }) : el('i', { textContent: 'empty (no colors)' }));
      change(field.column, text);
    };
    const addRow = (row = { color: colors[0], weight: 1, modifiers: [] }) => {
      const select = el('select', { title: 'Color' });
      for (const c of colors) select.add(new Option(c, c));
      select.value = row.color;
      const weight = el('input', { type: 'number', min: 1, step: 1, value: row.weight, title: 'Share of the card' });
      const line = el('div', { className: 'mk-blend-row' }, select, weight);
      for (const m of mods) {
        const box = el('input', { type: 'checkbox', value: m, checked: row.modifiers.includes(m) });
        line.append(el('label', { className: 'mk-check' }, box, ` ${m}`));
      }
      const remove = el('button', { type: 'button', className: 'mini', textContent: '×', title: 'Remove this color' });
      remove.addEventListener('click', () => {
        line.remove();
        write();
      });
      line.append(remove);
      line.addEventListener('input', write);
      line.addEventListener('change', write);
      rows.append(line);
    };
    const add = el('button', { type: 'button', className: 'mini', textContent: '+ Add a color' });
    add.addEventListener('click', () => {
      addRow();
      write();
    });
    wrap.append(rows, add, result);
    // Filled in from the current card by fillForm.
    wrap.fill = (value) => {
      rows.replaceChildren();
      for (const row of blendRows(value, field.colors, field.modifiers)) addRow(row);
      result.replaceChildren('In the spreadsheet: ', value ? el('code', { textContent: value }) : el('i', { textContent: 'empty (no colors)' }));
    };
    return wrap;
  }

  function fillForm() {
    for (const input of document.querySelectorAll('#maker-fields [data-column]')) {
      const value = work.current[input.dataset.column] ?? '';
      if (input.fill) input.fill(value);
      else if (input.matches('input, textarea, select')) input.value = value;
    }
    $('maker-art-name').textContent = work.current.art || 'none (pictures named after the card are found by themselves)';
    showRelevant();
    updateButtons();
  }

  // Hide the boxes that don't apply to this card (e.g. Armor on an action).
  function showRelevant() {
    const visible = visibleFields(layout, work.current);
    for (const box of document.querySelectorAll('#maker-fields .mk-field')) box.hidden = !visible.has(box.dataset.column);
  }

  function change(column, value) {
    // Pictures are found by card name, so renaming a saved card would lose its picture:
    // name the picture in the art column instead.
    if (column === 'name' && work.editing != null && !work.current.art) {
      const before = work.rows[work.editing]?.name;
      const picture = before && deps.assets().names.find((n) => looseName(n) === looseName(before));
      if (picture && looseName(value) !== looseName(before)) {
        work.current.art = picture;
        $('maker-art-name').textContent = picture;
      }
    }
    work.current[column] = value;
    if (switches.has(column)) showRelevant();
    else if (column === 'name') updateButtons();
    save();
    drawSoon();
  }

  // ---- Preview ----

  let pending = false;
  function drawSoon() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => {
      pending = false;
      draw();
    });
  }
  function draw() {
    if (!layout) return;
    const card = cardOf(work.current);
    renderCard(card, { layout, px: { width: 744, height: 1039 }, assets: deps.assets(), canvas: $('maker-canvas') });
  }

  // ---- Saved cards ----

  function updateButtons() {
    const editing = work.editing != null;
    $('maker-save').textContent = editing ? 'Save changes and start the next card' : 'Save card and start the next';
    $('maker-save').disabled = !String(work.current.name || '').trim();
    $('maker-cancel').hidden = !editing;
    const n = work.rows.length;
    $('maker-count').textContent = n;
    $('maker-show').disabled = !n;
    $('maker-download').disabled = !n;
    $('maker-clear').hidden = !n;
    renderList();
  }

  function renderList() {
    const list = $('maker-list');
    list.replaceChildren();
    work.rows.forEach((row, i) => {
      const edit = el('button', { type: 'button', className: 'mini', textContent: 'Edit' });
      edit.addEventListener('click', () => {
        work.current = { ...row };
        work.editing = i;
        save();
        fillForm();
        drawSoon();
        $('maker-fields').scrollIntoView({ block: 'start', behavior: 'smooth' });
      });
      const button = (text, title, act) => {
        const b = el('button', { type: 'button', className: 'mini', textContent: text, title });
        b.addEventListener('click', act);
        return b;
      };
      // Moving or removing a card keeps the one in the boxes pointing at the same card.
      const move = (to) => {
        const [card] = work.rows.splice(i, 1);
        work.rows.splice(to, 0, card);
        if (work.editing === i) work.editing = to;
        else if (work.editing != null && work.editing >= Math.min(i, to) && work.editing <= Math.max(i, to)) work.editing += i < to ? -1 : 1;
        changed();
      };
      const up = button('↑', 'Move up', () => move(i - 1));
      const down = button('↓', 'Move down', () => move(i + 1));
      up.disabled = i === 0;
      down.disabled = i === work.rows.length - 1;
      const copy = button('Copy', 'Add a copy of this card below it, to change', () => {
        work.rows.splice(i + 1, 0, { ...row, name: `${row.name || 'Card'} (copy)` });
        if (work.editing != null && work.editing > i) work.editing += 1;
        changed();
      });
      const remove = button('Remove', 'Remove this card', () => {
        work.rows.splice(i, 1);
        if (work.editing === i) work.editing = null;
        else if (work.editing > i) work.editing -= 1;
        changed();
      });
      const detail = [row.type || row.category, row.count && row.count !== '1' ? `×${row.count}` : ''].filter(Boolean).join(' · ');
      const li = el('li', { className: work.editing === i ? 'editing' : '' }, el('b', { textContent: row.name || '(no name)' }), detail ? el('span', { textContent: detail }) : null, el('span', { className: 'mk-row-actions' }, edit, copy, up, down, remove));
      list.append(li);
    });
    if (!work.rows.length) list.append(el('li', { className: 'mk-empty', textContent: 'No saved cards yet.' }));
  }

  function startNext() {
    const keep = Object.fromEntries(CARRY.filter((c) => work.current[c]).map((c) => [c, work.current[c]]));
    work.current = keep;
    work.editing = null;
    save();
    fillForm();
    drawSoon();
  }

  $('maker-save').addEventListener('click', () => {
    const row = Object.fromEntries(Object.entries(work.current).filter(([, v]) => String(v ?? '').trim() !== ''));
    if (work.editing != null) work.rows[work.editing] = row;
    else work.rows.push(row);
    startNext();
    if (deps.linked()) deps.showCards(csv(), sheetName(), { keepTab: true });
    $('maker-status').textContent = `Saved ${row.name}. ${work.rows.length} card${work.rows.length === 1 ? '' : 's'} so far.`;
    $('maker-fields').querySelector('input, textarea')?.focus();
  });
  $('maker-cancel').addEventListener('click', startNext);
  $('maker-new').addEventListener('click', () => {
    work.current = {};
    work.editing = null;
    save();
    fillForm();
    drawSoon();
  });
  $('maker-picture').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    await deps.addPicture(file);
    change('art', file.name);
    $('maker-art-name').textContent = file.name;
    e.target.value = '';
  });
  $('maker-show').addEventListener('click', () => deps.showCards(csv(), sheetName()));
  $('maker-download').addEventListener('click', () => {
    const base = work.source ? `${work.source.replace(/\.(csv|tsv|txt|xlsx)$/i, '')}-edited` : `${layout.id}-cards`;
    deps.download(new Blob([csv()], { type: 'text/csv' }), `${base}.csv`);
  });
  $('maker-clear').addEventListener('click', () => {
    if (!confirm(`Remove all ${work.rows.length} saved cards? Download the spreadsheet first if you want to keep them.`)) return;
    work.rows = [];
    work.editing = null;
    work.source = '';
    save();
    updateButtons();
  });
  $('maker-copy').addEventListener('click', () => {
    const rows = deps.loadedRows();
    if (!rows.length) return;
    work.rows.push(...rows);
    changed();
    $('maker-status').textContent = `Copied in ${rows.length} card${rows.length === 1 ? '' : 's'}. Click Edit on one to change it.`;
  });

  return {
    // The chosen look changed (or the page just opened).
    refresh() {
      const next = deps.layout();
      if (layout?.id === next.id) return;
      layout = next;
      fields = formFields(layout);
      switches = new Set(fields.filter((f) => f.switches).map((f) => f.column));
      work = load(layout.id);
      $('maker-look').textContent = layout.name;
      $('maker-status').textContent = '';
      buildForm();
      drawSoon();
    },
    // Pictures or fonts changed.
    redraw: drawSoon,
    // Edit a card from the Cards tab. rows: the cards on show; index: the one to edit;
    // source: their spreadsheet's name. Unless the cards on show are already the
    // maker's, they replace the maker's list (after asking, if it has cards), and from
    // then on every save updates the Cards tab. Returns false if the person said no.
    editCard({ rows, index, source }) {
      if (!deps.linked()) {
        if (work.rows.length && !confirm(`The Card maker has ${work.rows.length} saved card${work.rows.length === 1 ? '' : 's'} for this look. Replace them with the ${rows.length} cards on show, to edit those?\n\nDownload the Card maker's spreadsheet first if you want to keep its cards.`)) return false;
        work.rows = rows;
        work.source = source;
        deps.showCards(csv(), sheetName(), { keepTab: true });
      }
      work.current = { ...work.rows[index] };
      work.editing = index;
      save();
      fillForm();
      drawSoon();
      $('maker-status').textContent = `Editing ${work.current.name || 'a card'}. Saving updates it in the Cards tab too.`;
      return true;
    },
    // Whether there are cards on show to copy in.
    setCopyable(n) {
      $('maker-copy').hidden = !n;
      $('maker-copy').textContent = `Copy in the ${n} card${n === 1 ? '' : 's'} on show`;
    },
  };
}
