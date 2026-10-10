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
selector, and two downloads. The flow is:

1. Drop in a spreadsheet with the card information.
2. Drop in an image for each card.
3. Optionally, drop in a card back.
4. Choose what comes out: **either** a ZIP of individual card pictures (one per
   card), **or** a TTS deck containing the number of copies of each card given
   in the spreadsheet.

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

- The **name** at the top, in a graffiti font with a black outline and a hard
  drop shadow in the card's color, like spray paint. It has its own solid bar
  above the art. (It first sat over the top of the art on a see-through band;
  after testing with real art, the bar was made opaque so the name never
  fights the picture.)
- The **cost** as a number with a dollar sign in front (`$3`), on a tilted
  sticker in the top corner. Cells can hold just the number; a `$` already
  typed in the cell isn't doubled.
- The **art** as big as possible, and **never cropped**. The whole picture is
  scaled to fit its box. Art with an unusual shape is centered, with a dark
  textured panel filling the leftover space. The first version cropped art to
  fill the box, which cut off parts of real art with other proportions.
- A smaller **rules box** for the card's text and effect.
- A **type bar** at the bottom with the card's type followed by its tags:
  "THUG — CREW · LEADER". Tags go in one `tags` column, separated by
  commas (`Crew, Leader`). Semicolons and `|` are also accepted, but commas
  are the convention. Separate `tag1`, `tag2`, `tag3` columns were considered
  and rejected because the number of tags varies from card to card.
- A **stat row** at the very bottom, with each stat in its own small box.

**Thugs have three stats.** They are **Strengf**, **Helf** and **Steal**, in
that order from left to right. Use those spellings exactly. Each has its own
column (`strengf`, `helf`, `steal`), named after the stat so the spreadsheet
headers read the same as the cards. These replaced the placeholder columns
`stat1` to `stat3` from the first draft.

**Bling cards have an equip cost,** shown in the stat row as a single
"EQUIP COST" box in the middle slot. It goes in an `equip_cost` column and is
shown with a `$` in front, like the card's main cost. (At first only Thugs had
stats; the equip cost was added once it was remembered.)

**Cards without stats keep the same shape.** Most cards have no stat row. For
those, the type bar drops to the bottom edge and the rules box grows into the
freed space, so all the cards still look like one set. The stat row appears
whenever a card has any Thug stat or an equip cost filled in. It is driven by
the data rather than by the card type, so a new card type with stats would
work without changing how the row is triggered. If a Thug has some stats but
not others, each stat keeps its own slot and the missing ones are drawn faded,
so a stat is always in the same place.

**Fonts.** The brief was a cool, urban font reminiscent of graffiti and hip hop
culture. Six graffiti-style fonts were compared side by side (Sedgwick Ave
Display, Permanent Marker, Rubik Spray Paint, Rubik Wet Paint, Knewave and
Bungee). **Permanent Marker** was chosen for card names, for now. The cost
sticker stays in **Sedgwick Ave Display**, a graffiti handstyle named after
1520 Sedgwick Avenue in the Bronx, the birthplace of hip hop. Only the names
were asked to change, and the rest of the card was approved as it was. The
type bar uses **Bebas Neue**, a condensed poster face that suits street
signage and stays readable small. Rules text uses **Barlow**, because graffiti
lettering becomes hard to read at rules-text size. Switching any of these is a
one-word change in the layout.

The **stat boxes** use **Rubik Wet Paint**, dripping paint letters with a black
outline and a hard shadow in the card's color. The stats were first in Bebas
Neue for readability, but the brief changed to bolder, more stylized and more
flavorful, even at some cost to legibility. Six display fonts were compared on
a real stat row (Rubik Wet Paint, Rubik Spray Paint, Lacquer, Knewave, Bungee
Shade and Rubik Dirt), and Wet Paint was the most flavorful while keeping the
numbers readable.

**Surfaces are textured.** Flat panels looked too plain next to cards like
Magic: The Gathering and Flesh and Blood, which give their text boxes a
printed, textured look. The rules box looks like worn paper (mottled tone,
fine grain, edges darkened). The name bar, type bar, cost sticker and stat
boxes have a spray-paint grit with light from the top, plus a raised beveled
edge. The card background has a lighter grit. The textures are generated by
code from a fixed random seed, rather than shipped as texture images. That
means there are no image files to manage, they tint correctly to every card
type's color, and every render of a card is identical.

**Card types set the colors.** The game has four card types, and each has its
own color for the frame, cost sticker, type bar and stat boxes:

- **Thug:** funky purple.
- **Bling:** gold.
- **Negromancy:** dusky black. This is a dark gray that reads as black rather
  than true black, because a pitch-black frame would vanish into the card's
  dark background and look odd.
- **Dropped Move:** green.

The type-to-color map lives in the Street layout, so the spreadsheet only needs
the `type` column. A `color` column on a card still overrides it, for one-off
cards. The renderer supports this as a general feature: any layout can color
cards by any column's value.

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

## Card images

Images are matched to cards **by name**: an image named after its card
(`Block Party Boss.png`) goes on that card. This was chosen because it's how
people naturally name their art files. It also means the spreadsheet doesn't
need an extra column just to point at files. Matching ignores capitals,
spaces, dashes, underscores and punctuation, so `block-party-boss.jpg` and
`Block_Party_Boss.PNG` both match "Block Party Boss".

An optional `art` column can still name a specific file. This is useful when
several cards share one picture, or a file can't be named after its card. If
the named file is missing, the card falls back to an image named after it.

When images have been dropped in but a card that shows art has none, the page
lists those cards so typos in file names are easy to spot.

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

**Blank templates.** Under the layout picker there is a link to download a
blank CSV template for the chosen layout. The template's columns are worked out
from the layout itself, in the order the layout draws them, so every layout
(including new ones) gets an up-to-date template with no extra work.
Hand-written template files per layout were rejected because they would drift
out of date whenever a layout changed. Templates hold the header row only,
because a sample card could too easily end up in someone's deck; the example
spreadsheets show filled-in cards instead. The `art` column is left out, since
images match cards by name. `color` is included only for layouts that don't
color cards by type.

A CSV can't hold comments, so a column that needs explaining carries a short
note in its header instead, such as `tags (separate with commas)`. When a
spreadsheet is read, anything in parentheses in a header is ignored, so the
note can stay in place. That also lets people annotate their own column
headers.

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

  How the deck points at these files depends on the system, based on testing
  in TTS:
  - **Windows:** a plain file path
    (`C:\Users\…\Saved Objects\Card Builder\images\…`), the form TTS's own
    documentation shows for local files. Not yet tested in TTS on Windows.
  - **Linux and Mac:** a `file:///` address (`file:///home/…`). In a test on
    Linux, TTS treated a plain `/home/…` path as a web address and failed with
    "Cannot connect to destination host". With `file:///` it tried to read the
    file itself.

  That Linux test still failed after the switch, with "unsupported format:
  UNKNOWN" errors for every picture, whether or not the spaces in the folder
  names were encoded as `%20`. Others report that `file:///home/…` works, so
  the most likely cause is that the pictures weren't at the exact folder the
  deck pointed to. This is still being confirmed. The folder box also forgives
  easy slips: surrounding quotes (which Windows adds with "Copy as path"), a
  pasted `file:///` address, or giving the `Card Builder` folder itself instead
  of Saved Objects. The on-page help shows the exact folder the deck will look
  in, to make a wrong location easy to spot.
- **A website:** the player gives a web address and uploads the images there.
  This works for online play. GitHub Pages works for this.

**Loading instructions live on the page.** Under the TTS download button
there is a collapsible "How to load your deck into TTS" guide, so the steps are
right where people need them rather than only in the README. It shows only the
steps for the image location that was chosen, fills in the folder or web
address that was typed, covers the usual problems (an extra folder from
unzipping, blank cards, updating a deck), and opens by itself after a TTS
download. A collapsible section was chosen over a pop-up window because it can
be read alongside the form and doesn't get in the way. The same steps also ship
inside the ZIP as `HOW TO IMPORT.txt`.

Card hover descriptions in TTS include the type, subtype and tags, the cost,
the rules text, the stats and the flavor text. Any other filled-in column is
listed by its column name (for example "Strengf 4 · Helf 3 · Steal 2"). That
way a layout's own stats show up on hover without the TTS export needing to
know about them.

## Documentation

Outward-facing writing stays short and is about using the tool, not about how
it was built. The README is a concise how-to for people making cards, with no
change notes or development process. Commit messages describe the work in
general terms ("layout work", "font testing") rather than listing
layout-specific details. The detailed reasoning lives here in DESIGN.md.

## Visual style

The page uses the dark brown and copper look of the Flagon sites, with Cinzel
for titles.

Each layout picks its card fonts from the font library. Default, Full Art and
Text Only use Cinzel for names and Crimson Pro for body text. Street uses the
fonts described above. All card fonts come from Google Fonts, and each has a
fallback (Georgia, Impact or Arial) if they can't load.
