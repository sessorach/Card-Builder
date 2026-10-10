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

## What this is
Repo: `sessorach/Card-Builder` on GitHub (public, default branch `main`). A static web page: drop a spreadsheet + art → preview cards → download a zip of card PNGs, or a zip containing a Tabletop Simulator Saved Object (the primary use). No build step, no framework, no server.

## Where things live
- `index.html`, `css/style.css`: the page.
- `js/main.js`: UI wiring and state (inputs, preview, export buttons, localStorage settings).
- `js/spreadsheet.js`: CSV/TSV parser, header aliases, rows → cards, grouping by deck. Pure, Node-tested.
- `js/xlsx.js`: minimal .xlsx reader (JSZip + DOMParser). Browser-only; covered by e2e.
- `js/richtext.js`: text markup (`**bold**`, `*italic*`, `{icon}`, `\n`), word wrap, shrink-to-fit, TTS BBCode. Pure; measuring is injected.
- `js/render.js`: canvas renderer, `AssetStore` (images by file name), themes from the `color` column, generated backs.
- `js/tts.js`: sheet planning, image URLs, Saved Object JSON. Pure, Node-tested.
- `js/export.js`: builds both zips (images, TTS). Browser-only.
- `js/sizes.js`: card sizes (poker only for now) and DPI.
- `layouts/*.js` + `layouts/index.js`: layout definitions and their registry.
- `examples/`: example CSV and art (`tools/make-example-art.py` regenerates the art; needs Pillow).
- `vendor/jszip.min.js`: vendored JSZip 3.10.1 (from the npm tarball).
- `tests/unit/*.test.mjs` (node:test), `tests/e2e/run.mjs` (Playwright), `tests/fixtures/*.xlsx`.

## Run and test
- Serve: `npm run serve` (python http.server on :8000). ES modules **don't load from file://**; always serve over http.
- Unit tests: `npm test`.
- E2E: `npm run test:e2e`. It starts its own static server, drives Chromium, and checks both zips. Screenshots and downloads go to `test-output/` (gitignored). Look at `preview.png`, `lightbox.png` and `fire-sheet.jpg` after visual changes.
- In the cloud container: `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install` first; Chromium is preinstalled at /opt/pw-browsers and Playwright 1.56.1 matches it.
- CI (`.github/workflows/test.yml`) runs unit + e2e tests on every push; keep both green before pushing.

## Layout format (quick reference)
Elements are drawn in order. `x/y/w/h` are % of card width/height; `size`, `minSize`, `radius` and `strokeWidth` are % of card **width**.
- `rect`: `fill`, `stroke`, `strokeWidth`, `radius`
- `image`: `field` (default `art`), `radius`, `stroke`. A missing image draws a placeholder.
- `text`: one of `field`, `join: [...]` + `sep`, or `parts: ['text', { field: 'flavor', italic: true }]` (paragraph gap between parts). Also `font: 'title'|'body'`, `size`, `minSize` (shrink floor), `lineHeight`, `align`, `valign`, `color`, `weight: 'bold'`, `italic`, `shadow`, `shrink: false`.
- Any element: `when: 'field'` (draw only if non-empty), `unless`, `opacity`.
- Color tokens: `accent`, `accentDark`, `accentLight`, `ink`, `paper`, `paperLight` (accent comes from the card's `color` column, else the layout's `defaultColor`). Any CSS color string also works.

## Conventions
- Keep game-specific knowledge out of `render.js` (see DESIGN.md's standing rule). New designs go in `layouts/`.
- Pure logic goes in Node-testable modules with no DOM; add unit tests for it.
- New third-party code is vendored into `vendor/` (with its license), never loaded from a CDN at runtime. Google Fonts is the only external load.
- Problems with user input become warnings in the UI, not exceptions.

## Gotchas and past mistakes
- `node --test tests/unit/` treats the directory as a file on Node 22; use the quoted glob in `package.json`.
- `package.json` has `"type": "module"`, so `require('vendor/jszip.min.js')` doesn't return JSZip in Node. The UMD build registers `globalThis.JSZip` instead (see `tests/e2e/run.mjs`).
- cdn.sheetjs.com and cdnjs are blocked from the cloud container; the npm registry works (`npm pack <pkg>` to fetch a tarball for vendoring).
- The Claude GitHub App can't create repositories (403); the user has to create them.
- TTS caches images by URL, so sheet file names must keep their timestamp.
- Canvas only draws fonts that have already loaded; `loadFonts()` runs before any render. A new font needs adding there too.
