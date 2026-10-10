# CLAUDE.md: working notes for Card Builder

## Start of every session
1. Read this file and `DESIGN.md` before doing anything else.
2. If anything the user says contradicts either file, point it out and ask; don't silently pick one.

## Record-keeping rules (from the user)
- Keep two running records and maintain them without being asked:
  - `CLAUDE.md` (this file): practical working notes: where things live, how to build and test, settled conventions, past mistakes and how to avoid them. Fix or remove anything stale.
  - `DESIGN.md`: the project's decision record for human readers, in plain prose: what was decided, why, alternatives rejected, and standing rules. No workflow notes there.
- When the user makes a decision, corrects me, or explains their reasoning, record it in the right file **in the same commit** as the related change, never as a later catch-up.
- Commit and push doc updates along with the work.
- **Commit messages:** short, general summaries of the kind of work ("Layout work: colors and title font", "Font testing", "Art matching improvements"). No layout-specific details such as stat names, type names or color values. Keep the attribution trailers.
- **README:** a concise how-to for people using the site. No change notes, no development or process details, no per-layout column lists (the page's Columns section has those). Outward-facing text stays short; detail goes in DESIGN.md.

## What this is
Repo: `sessorach/Card-Builder` on GitHub (public, default branch `main`). GitHub Pages is on and deploys `main`. A static web page: drop a spreadsheet + art → preview cards → download a zip of card PNGs, or a zip containing a Tabletop Simulator Saved Object (the primary use). No build step, no framework, no server.

## Where things live
- `index.html`, `css/style.css`: the page. The TTS help (`#tts-help`) is a `<details>` whose steps switch with `[data-help-mode]` and fill in the user's folder or URL via `[data-fill]` (wired in `setupControls` in main.js). Keep its steps consistent with `instructions()` in js/export.js (`HOW TO IMPORT.txt`) and the README.
- `js/main.js`: UI wiring and state (inputs, preview, export buttons, localStorage settings).
- `js/spreadsheet.js`: CSV/TSV parser, header aliases, rows → cards, grouping by deck. Pure, Node-tested.
- `js/xlsx.js`: minimal .xlsx reader (JSZip + DOMParser). Browser-only; covered by e2e.
- `js/richtext.js`: text markup (`**bold**`, `*italic*`, `{icon}`, `\n`), word wrap, shrink-to-fit, TTS BBCode. Pure; measuring is injected.
- `js/render.js`: canvas renderer, `AssetStore` (images by file name or loosely by card name), `findArt` (art column → card name fallback), `cardAccent` (color column → layout `colorBy` → default), generated backs. It must stay importable in Node (no DOM use at module top level) so these helpers stay unit-tested in `tests/unit/render.test.mjs`.
- `js/fonts.js`: font library (Google Fonts specs + faces to preload), `DEFAULT_FONTS`, and `loadFonts()`, which injects the card-fonts stylesheet. `index.html` only links the UI font.
- `js/template.js`: blank CSV templates derived from a layout's elements (`templateColumns`, `templateCsv`). Columns a layout shows with `list: true` get a `(separate with commas)` header note; `normalizeHeader` in spreadsheet.js strips any `(…)` so notes are harmless. Pure, Node-tested (`tests/unit/template.test.mjs` pins the Street and Default column lists, so update those when a layout's fields change). The download link sits under the layout picker.
- `js/tts.js`: sheet planning, image URLs, Saved Object JSON. Pure, Node-tested.
- `js/export.js`: builds both zips (images, TTS). Browser-only.
- `js/sizes.js`: card sizes (poker only for now) and DPI.
- `layouts/*.js` + `layouts/index.js`: layout definitions and their registry: `default` (formerly `classic`), `full-art`, `text-only`, `street` (the user's game; Thug stats are `strengf`, `helf`, `steal`, spelled exactly so; Bling's `equip_cost` is a single centered stat box shown with `$`).
- `examples/`: `example-cards.csv` (Default/Full Art/Text Only; uses an `art` column for some cards) and `street-cards.csv` (Street; no art column, every image is matched by card name). `examples/manifest.json` lists which images each example loads, so a new example image must be added there. Example art comes from `tools/make-example-art.py` (deterministic; needs Pillow; file names follow the cards; append new palettes at the end so existing images don't change).
- `vendor/jszip.min.js`: vendored JSZip 3.10.1 (from the npm tarball).
- `tests/unit/*.test.mjs` (node:test), `tests/e2e/run.mjs` (Playwright), `tests/fixtures/*.xlsx`.

## Run and test
- Serve: `npm run serve` (python http.server on :8000). ES modules **don't load from file://**; always serve over http.
- Unit tests: `npm test`.
- E2E: `npm run test:e2e`. It starts its own static server, drives Chromium, and checks both zips. Screenshots and downloads go to `test-output/` (gitignored). After visual changes, look at `preview.png`, `lightbox.png`, `fire-sheet.jpg`, `preview-street.png` and `street-*.png` (full-size Street cards, one per example card: two Thugs with stats, a Bling with an equip cost, and one of each other type). No example card has partial stats any more (faded slots), so check that case by hand if the stat row changes.
- E2E steps share one page and run in order: the layout-selector step expects the Default example (8 cards) to be loaded, so steps that load other spreadsheets go after it.
- In the cloud container: `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install` first; Chromium is preinstalled at /opt/pw-browsers and Playwright 1.56.1 matches it.
- CI (`.github/workflows/test.yml`) runs unit + e2e tests on every push; keep both green before pushing.

## Layout format (quick reference)
Layout files are JS modules, so they can use helper functions and constants to build elements (see `layouts/street.js`, which generates its with-stats and no-stats variants from one function).
Top-level: `id`, `name`, `description`, `defaultColor`, `elements`, optional `colorBy: { field, colors: { value: color } }` (case-insensitive value → accent; a card's `color` column still wins), and optional `fonts`: role → `{ font: <FONT_LIBRARY key>, weight, boldWeight }`. Roles default to `title` = cinzel and `body` = crimson; layouts may add roles (Street adds `cost` and `label`).
Elements are drawn in order. `x/y/w/h` are % of card width/height; `size`, `minSize`, `radius` and `strokeWidth` are % of card **width**.
- `rect`: `fill`, `stroke`, `strokeWidth`, `radius`
- `image`: `field` (default `art`), `radius`, `stroke`. Finds the file named in `field`, else an image named after the card; otherwise draws a placeholder.
- `text` content, one of:
  - `text: 'LABEL'` (fixed text)
  - `field` (plus `prefix`/`suffix`, added only if the value doesn't already have it; `list: true` + `listSep` splits a comma/semicolon/pipe-separated cell)
  - `join: [...]` + `sep` (+ `sepColor`): inline on one line
  - `parts: [...]`: paragraphs with a gap between them
  - `join`/`parts` entries are a field name or `{ field, bold, italic, color, prefix, suffix, list, listSep }`.
- `text` style: `font` (role), `size`, `minSize` (shrink floor), `lineHeight`, `align`, `valign`, `baseline` (em offset, default 0.32; caps-only fonts like Bebas look centered at ~0.36), `color`, `weight: 'bold'`, `italic`, `outline` + `outlineWidth` (em, default 0.12), `shadow` (`true` for a soft glow, or `{ color, x, y, blur }` in ems), `shrink: false`.
- Any element: `when` / `unless` (a field, or a list of fields meaning "any of them has a value"), `opacity`, `rotate` (degrees, around the element's center).
- Color tokens: `accent`, `accentDark`, `accentLight`, `onAccent` (black or white, whichever reads on the accent), `ink`, `paper`, `paperLight`. Accent comes from the card's `color` column, else the layout's `defaultColor`. Any CSS color string also works.

## Conventions
- Keep game-specific knowledge out of `render.js` (see DESIGN.md's standing rule). New designs go in `layouts/`.
- Pure logic goes in Node-testable modules with no DOM; add unit tests for it.
- New third-party code is vendored into `vendor/` (with its license), never loaded from a CDN at runtime. Google Fonts is the only external load.
- Problems with user input become warnings in the UI, not exceptions.
- Columns keep one meaning across layouts; formatting (like Street's `$` cost) belongs in the layout via `prefix`/`suffix`, never in the data or the renderer. Shared columns so far: name, count, deck, layout, art, cost, type, subtype, tags, text, flavor, stats, strengf, helf, steal, equip_cost, color.
- TTS hover descriptions (`cardDescription` in js/tts.js) list any column not in its `DESCRIBED` set as "Label value", so new stat columns need no TTS changes. A new column that *shouldn't* appear on hover must be added to `DESCRIBED`.
- Renaming a layout id breaks spreadsheets that name it in their `layout` column (they fall back to the default, with a warning). Mention it to the user when it happens.

## Gotchas and past mistakes
- `node --test tests/unit/` treats the directory as a file on Node 22; use the quoted glob in `package.json`.
- `package.json` has `"type": "module"`, so `require('vendor/jszip.min.js')` doesn't return JSZip in Node. The UMD build registers `globalThis.JSZip` instead (see `tests/e2e/run.mjs`).
- cdn.sheetjs.com and cdnjs are blocked from the cloud container; the npm registry works (`npm pack <pkg>` to fetch a tarball for vendoring).
- The Claude GitHub App can't create repositories (403); the user has to create them.
- TTS caches images by URL, so sheet file names must keep their timestamp.
- Canvas only draws fonts that have already loaded; `loadFonts()` (js/fonts.js) preloads every face listed in `FONT_LIBRARY`. A new font, or a new weight/italic of an existing one, needs its face added there, or it silently renders in the fallback font.
- To compare fonts quickly, render an HTML sample page with Playwright (scratchpad) rather than editing layouts back and forth.
