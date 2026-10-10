# Card Builder

Turn a spreadsheet of card info and a folder of art into finished card images
and ready-to-load **Tabletop Simulator** decks, all in your browser.

## Using it

1. **Spreadsheet:** drop a `.csv` or `.xlsx` file onto the page. Each row is a
   card. Click an example (*Default* or *Street*) to see how it works, or
   download an example spreadsheet as a starting point.
2. **Card art:** drop your images (or a whole folder). They're matched to the
   `art` column by file name.
3. **Card back** (optional): drop one image to use as the back. Without one,
   each deck gets a generated back.
4. **Style:** pick a layout: Default, Full Art, Text Only or Street. A
   `layout` column can override it per card.
5. **Export:**
   - **Download TTS deck:** unzip into your Tabletop Simulator `Saved Objects`
     folder, then spawn each deck from *Objects → Saved Objects → Card Builder*.
     Follow `HOW TO IMPORT.txt` in the zip.
   - **Download card images:** one PNG per card at 300 DPI, plus the backs.

### Spreadsheet columns

Only `name` is required.

| Column | What it does |
|---|---|
| `name` | Card name |
| `count` | Copies in the deck (default 1; 0 leaves the card out) |
| `deck` | Which deck the card belongs to. Each deck becomes its own TTS object |
| `art` | Image file name, e.g. `flame-imp.png` |
| `cost` | Badge in the corner (Street shows it as `$3`) |
| `type`, `subtype` | Type line, e.g. "Creature — Imp" |
| `tags` | Street: comma-separated tags shown after the type |
| `text` | Rules text |
| `flavor` | Italic flavor text |
| `stats` | Default, Full Art, Text Only: one badge, e.g. `3 / 2` |
| `strengf`, `helf`, `steal` | Street: the three Thug stats, each in its own box (leave empty on other cards for a bigger rules box) |
| `color` | Card color: a name (`crimson`) or hex (`#3b5b7a`) |
| `layout` | `default`, `full-art`, `text-only` or `street` |

Text can use `**bold**`, `*italic*`, line breaks (Alt+Enter in the cell, or
`\n`), and icons like `{fire}`. An icon draws an uploaded image named
`fire.png` or `icon-fire.png`.

### Playing online in TTS

Choose **A website** under export, enter the address where you'll host the
images, then upload the files from the zip's `images/` folder there. Any
static host works (GitHub Pages, for example). With **This computer**, only
you will see the card images.

## Making new layouts

Layouts live in `layouts/`. Copy one, change the positions, colors and fonts,
and add it to `layouts/index.js`. It then shows up in the layout selector.
Positions are percentages of the card, so a layout works at any resolution.
`CLAUDE.md` has a quick reference for the format.

## Development

No build step. Serve the folder over HTTP (JavaScript modules don't load from
`file://`):

```sh
npm run serve        # http://localhost:8000
npm test             # unit tests (Node 20+)
npm install && npm run test:e2e   # browser end-to-end test (Playwright)
```

See `DESIGN.md` for why things are built the way they are.
