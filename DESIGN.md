# Card Builder: Design Decisions

This is the decision record for Card Builder: what we decided, why, and what we
considered instead. Newest decisions are added to the relevant section; when a
decision changes, the old reasoning is replaced rather than left to contradict
the new one.

## Purpose

Card Builder exists because the online card creators we tried each impose their
own card layout, and we want our own. The core job is simple: drop in a
spreadsheet of card information plus a set of card images, and get finished
card pictures out.

**Tabletop Simulator decks are the primary use.** Downloading plain card images
matters too, but when a trade-off has to be made, the TTS output wins.

The tool should stay lightweight: a single page, a handful of layouts with a
selector, and two downloads (an archive of card images, and a TTS deck).

## Separate repository

Card Builder lives in its own repository rather than inside the Flagon Dice
site. It is a separate tool with its own data and its own pace of change, and
mixing it into the character-sheet site would make both harder to work on. It
borrows the Flagon sites' approach anyway: a static page with no server, data
in plain files, hosted on GitHub Pages.

## A static web page with no build step

The tool is a plain web page using JavaScript modules directly. There is no
build step, no framework and no server. Anyone can use it from a browser, and
anyone can change it with a text editor.

- **Rejected: React from a CDN with in-browser Babel** (what the Flagon Dice
  site uses). The heart of this tool is canvas drawing, which gains nothing from
  React, and in-browser Babel makes the page slower to start.
- **Rejected: desktop tools like nanDECK or Squib.** They are flexible, but our
  friends would each have to install and learn them. A web page needs nothing.

Third-party code is copied into `vendor/` rather than loaded from a CDN, so the
tool keeps working if a CDN changes or disappears.

## Layouts are swappable data

Being able to change card designs without rewriting the program was the main
requirement. The code is split into three parts that don't depend on each
other's details:

1. **Card data**: the spreadsheet. Each row is a card and each column is a
   field.
2. **Layouts**: one file per design in `layouts/`. A layout is a list of
   shapes, images and text boxes, each placed on the card and tied to a field
   name.
3. **Renderer**: draws any card with any layout. It knows nothing about our
   game, such as what "cost" or "stats" mean. It only draws what a layout
   asks for.

**Standing rule:** adding or changing a card design means editing a layout
file, never the renderer. Game-specific knowledge belongs in layouts and
spreadsheets only. If a new design needs something the renderer can't do yet,
add a general-purpose feature to the renderer (for example "draw a rounded
box") rather than a special case for that design.

The page has a layout selector that sets the default. A `layout` column in the
spreadsheet overrides it for individual cards, so one deck can mix designs. It
ships with four layouts:

- **Default:** a framed card with an art window. This was the first layout,
  originally called Classic. It was renamed Default to serve as the general
  starting point, while more specific layouts are designed alongside it.
- **Full Art:** the art covers the whole card.
- **Text Only:** no art, for spells, events and prototypes.
- **Street:** the first layout designed for our game (see below).

Positions in a layout are percentages of the card rather than pixels or
millimeters. Text sizes are percentages of the card's width. That way the same
layout works at any resolution, and at other card sizes later.

### Columns are shared; each layout shows them its own way

Different layouts (or "formats") need different elements, but there is a lot
of overlap. So a column means the same thing in every layout (`name`, `cost`,
`art`, `text`, `type` and so on), and each layout decides which columns to show
and how to present them. For example, `cost` is a plain number in a badge on
Default but is shown as `$3` on Street. Default shows one `stats` column in a
single badge, while Street uses three named stat columns in separate boxes.

**Standing rule:** a column keeps its meaning across layouts. Presentation
belongs to the layout. The cell holds the value (`3`), and the layout adds any
decoration (the `$`). A layout adds a new column only for something no existing
column covers.

Layouts also choose their own fonts from a shared font library
(`js/fonts.js`), so a design can look completely different without changing
the renderer.

### The Street layout

Street was specified element by element:

- The **name** at the top, in a graffiti font. It sits over the top edge of the
  art with a dark band behind it, a black outline, and a hard drop shadow in
  the card's color, like spray paint.
- The **cost** as a number with a dollar sign in front (`$3`), on a tilted
  sticker in the top corner. Cells can hold just the number; a `$` already
  typed in the cell isn't doubled.
- The **art** as big as possible: it takes up more than half the card.
- A smaller **rules box** for the card's text and effect.
- A **type bar** at the bottom with the card's type followed by its tags:
  "THUG — CREW · LEADER". Tags go in one `tags` column, separated by
  commas. Separate `tag1`, `tag2`, `tag3` columns were considered and rejected
  because the number of tags varies from card to card.
- A **stat row** at the very bottom: three stats, each in its own small box.

**Only Thug units have stats.** The three stats are **Strengf**, **Helf** and
**Steal**, in that order from left to right. Use those spellings exactly. Each
has its own column (`strengf`, `helf`, `steal`), named after the stat so the
spreadsheet headers read the same as the cards. These replaced the
placeholder columns `stat1` to `stat3` from the first draft.

**Cards without stats keep the same shape.** Many cards aren't Thugs, so most
cards have no stat row. For those, the type bar drops to the bottom edge and
the rules box grows into the freed space, so all the cards still look like one
set. The stat row appears whenever a card has any of the three stats filled
in. It is driven by the data rather than by the word "Thug", so a new card type
with stats would work without changing the layout. If a card has some stats
but not others, each stat keeps its own slot and the missing ones are drawn
faded, so a stat is always in the same place.

**Fonts.** The brief was a cool, urban font reminiscent of graffiti and hip hop
culture. Names and cost use **Sedgwick Ave Display**, a graffiti handstyle
named after 1520 Sedgwick Avenue in the Bronx, the birthplace of hip hop. The
type bar and stats use **Bebas Neue**, a condensed poster face that suits
street signage and stays readable small. Rules text uses **Barlow**, because
graffiti lettering becomes hard to read at rules-text size. Permanent Marker,
Rubik Spray Paint, Rubik Wet Paint, Knewave and Bungee were also tried for
names, and switching to any of them is a one-word change in the layout.

## Drawing on a canvas

Cards are drawn directly onto an HTML canvas.

- **Rejected: building cards as web pages and screenshotting them**
  (html-to-image and similar). That approach often goes wrong with fonts that
  haven't loaded and with images, and the result isn't pixel-exact. Since the
  outputs are images, drawing images directly is simpler and more reliable.

The cost is that we handle text wrapping ourselves. The renderer wraps words,
shrinks text until it fits its box, and supports a small markup in any text
cell: `**bold**`, `*italic*`, `{icon}` and line breaks.

An `{icon}` draws an uploaded image with that name (`fire.png` or
`icon-fire.png`). If no such image exists, it draws a ringed initial so the
card still reads. Missing card art draws a placeholder that names the missing
file instead of failing.

Cards are drawn as full rectangles with no transparent corners. TTS rounds card
corners itself, and square corners suit printing.

## Card size

Standard poker size (63 × 88 mm) is the only size for now. The size selector
and the size list are already in place, and more sizes are expected later.
Adding one is a single entry in `js/sizes.js`, since layouts are positioned in
percentages. The selector shows disabled until there is a second size.

Cards render at 300 DPI (744 × 1039 pixels for poker size), which is print
quality.

## Card backs

There is a separate place to upload a card back, and the uploaded back is used
for every deck. Without an upload, each deck gets a generated back in its own
color with the deck name on it, so the tool works with no art at all.

Per-deck back uploads were left out to keep the page simple, and we confirmed
that one shared back is fine for now. We will probably want a different back
for some decks eventually. A `back` column would be the natural way to add
that.

## Spreadsheets

The page reads CSV, TSV and Excel `.xlsx` files. Only a `name` column is
required, and common alternative column names are recognized (`qty` for
`count`, `rules text` for `text`, and so on). A `deck` column splits cards into
separate decks. A `count` column sets the number of copies, and a count of 0
leaves the card out.

`.xlsx` files are read by a small reader of our own built on JSZip, which is
already needed for the downloads.

- **Rejected: SheetJS.** The current version is only distributed from SheetJS's
  own servers, and the copy on npm (0.18.5) has known security problems with
  crafted files. It is also large. A worksheet's cell text is all we need.

Old-style `.xls` files are not supported. Saving as `.xlsx` or `.csv` works
around it.

Problems in the spreadsheet show up as warnings above the preview, and the
rest of the cards still render. Examples include an unknown layout name, a
count that isn't a number, or art that wasn't uploaded.

## Tabletop Simulator output

TTS builds custom decks from **sheets**: grid images of up to 10 × 7 cards,
plus one back image. Each card refers to its sheet and slot.

**We produce a TTS Saved Object, not just sheet images.** The download is a
`Card Builder` folder that goes into the TTS "Saved Objects" folder. It holds
one `.json` file per deck (each `deck` value in the spreadsheet becomes its own
in-game object), a thumbnail for each, and the sheets. Every card arrives with
its name and rules text already filled in, so cards can be searched and read on
hover in TTS, and copies are already in the deck.

- **Rejected: sheets only, imported by hand** (what the TTS Deck Editor
  produces). Every deck would need its grid size and card count typed in, and
  cards would arrive without names. The download still includes these numbers
  in `HOW TO IMPORT.txt` as a fallback.

Specific choices:

- **At most 69 cards per sheet.** TTS may use the last slot of a full 10 × 7
  sheet as the "hidden" card face, so we leave it empty. Larger decks span
  several sheets but still load as one deck.
- **Grids are kept roughly square** (4 cards → 2 × 2, 20 → 4 × 5) to waste the
  fewest empty slots, with the 2 × 2 minimum TTS requires.
- **"Back is hidden" is on,** so cards in other players' hands show the back.
- **Sheets are JPEG at 92% quality.** Full-resolution PNG sheets can run to tens
  of megabytes, which makes them slow to load, especially for friends
  downloading them online.
- **Sheet file names include a timestamp.** TTS caches images by web address,
  so reusing a name would keep showing the old art after an update.
- **Two resolutions:** High keeps full 300 DPI cards (a full sheet stays under
  8192 pixels), and Compatible scales sheets to 4096 pixels for older graphics
  cards.

TTS loads images from web addresses, so the export asks where the images will
live:

- **This computer:** the player gives their Saved Objects folder path, and the
  deck points at the files there. This is the quickest option, but other
  players can't see the images.
- **A website:** the player gives a web address and uploads the images there.
  This works for online play. GitHub Pages works for this.

Card hover descriptions in TTS include the type, subtype and tags, the cost,
the rules text, the stats and the flavor text. Any other filled-in column is
listed by its column name (for example "Strengf 4 · Helf 3 · Steal 2"). That
way a layout's own stats show up on hover without the TTS export needing to
know about them.

## Visual style

The page uses the dark brown and copper look of the Flagon sites, with Cinzel
for titles.

Each layout picks its card fonts from the font library. Default, Full Art and
Text Only use Cinzel for names and Crimson Pro for body text. Street uses the
fonts described above. All card fonts come from Google Fonts, and each has a
fallback (Georgia, Impact or Arial) if they can't load.
