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
ships with these layouts:

- **Default:** a framed card with an art window. This was the first layout,
  originally called Classic. It was renamed Default to serve as the general
  starting point, while more specific layouts are designed alongside it.
- **Full Art:** the art covers the whole card.
- **Text Only:** no art, for spells, events and prototypes.
- **Street:** the first layout designed for our game (see below).
- **FlagonQuest:** reference cards for FlagonQuest techniques and items (see
  below).
- **Allies** (working name, draft): characters for another tabletop game, with
  their actions to follow (see below).

**One layout per use case, with variants per card type.** A game or project
gets one layout under one name, even when it has several kinds of card. The
layout adjusts itself to each kind: Street adds its stat boxes only to cards
that have stats, and FlagonQuest switches between its technique and item
versions by whether the row has a Category. The user prefers this to a
separate layout per card type because the main thing is a consistent look
across a game's cards; the kinds of card can differ in what they show, but
they share the frame, colors and fonts. New projects (such as the planned
allies-and-actions cards) follow the same pattern.

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

### The FlagonQuest layout

FlagonQuest is a separate TTRPG with its own companion site (the
`flagonquest` repository). The game is also played in Tabletop Simulator,
where it helps to have each technique (ability) and item as a physical card.
This layout is that companion. No picture is needed: it is all game
information.

**One layout for techniques and items.** There used to be two layouts, one
for each. The user asked for a single one that adjusts to the kind of card, so
there is now one FlagonQuest layout: a row with a Category is an item, and any
other row is a technique. Both share the header and frame; the second row and
the body change with the kind of card. The old layout names still work in a
spreadsheet's `layout` column.

**It reads FlagonQuest's own spreadsheets as-is.** FlagonQuest keeps its
content in spreadsheets (`scripts/techniques.csv` and `scripts/items.csv`),
and dropping either file into Card Builder makes a card per row, with no
reformatting. To get there without breaking the shared-columns rule,
FlagonQuest's headers map onto the existing columns where they mean the same
thing: "Effects" is the rules text and "Description (Fluff)" is flavor text,
both as general header aliases. The FlagonQuest-only concepts get their own
columns. A spreadsheet with either file's columns (and no layout column)
switches to this layout by itself, so the drop-in really is one step.

**The card shows what the Character Sheet shows.** The user wants the cards
to look like the site's Character Sheet, so they can be kept in sync when the
site changes. The card content mirrors the sheet's technique and item tiles:

- Techniques: the name, with an orange Encounter badge and a level badge
  ("Lv 1–4", or "Draft") in the corner; the other tags as small chips, with
  Buildable in purple and Duplicate in green; then gold-labelled Condition,
  Action, Cost and Target lines, the effects, the choice effects (one per
  line) and Special.
- Items: the name; a "Category · Slot" chip, plus a level chip for Masterwork
  and Material items; then the effects, the weapon line in faint text
  ("Accuracy +1 · Damage 3 + [Cunning] · Range 19 · Skill Archery · Parry +0 ·
  Might Req 4"), the flat bonuses as amber badges ("Physical Resist +2"), and a
  material's types as amber badges.

What the sheet leaves out stays off the card face too: flavor text, prereqs,
an item's cost, value per level and crafting materials, and the number of
hands a weapon takes. All of it is in the TTS hover text instead, so it's one
mouse-over away in a game. (Item flavor text used to stay on the card face,
because for plain weapons and armor it is the only text. The user chose to
match the sheet instead.) The sheet's own interactive parts (the quantity,
Equipped and Expended boxes, choice pickers) have no place on a card. A
technique with choice effects, like Profession, lists every option, because a
card has no pick to narrow it down.

**Inside a card frame.** The sheet's tiles are flat. The card keeps its own
gold frame and the slightly textured navy panel, so it still reads as a
physical card on the table; everything inside follows the sheet's colors,
fonts (MedievalSharp names), chips and badges. The user chose this over a
flat tile.

**Keeping it in sync.** The layout file starts with a map from each part of
the site's code to the part of the layout that copies it (the color constants,
the technique tile, the item tile, the bonus list and the weapon line). When
the site changes, those are the places to update. Automatic syncing (drawing
the cards with the site's own code) was rejected: the site is a React page
that loads its libraries from the web at run time and lays out HTML, while
Card Builder draws on a canvas with no outside code, so the two can't share
drawing code.

**Cards for one character come from the site.** The user wants a player to
turn their own character into cards, including built techniques (a Battle
Maneuver built at Level 2 with Lunging ×2 and Wind Slash), with as little
added to the FlagonQuest site as possible. So the site's Character Sheet gets a
small button that sends that character's cards to Card Builder, and Card
Builder does the drawing, image downloads and TTS decks as it does for a
spreadsheet. The site works out everything that depends on the character,
because it already does for the sheet: the built level and Features (with X
filled in), the picked choice effects only, per-copy picks, skill totals as
numbers, renamed builds, item quantities as copy counts, and combined item
bonuses. Card Builder only adds three text columns it shows as given: built
features, picks, and the powers on a custom item. Techniques and items go in
separate decks named after the character.

The cards travel in the link itself (see "Cards sent in a link" below), so
nothing is uploaded anywhere and no server is involved.

- **Rejected: drawing the cards inside the FlagonQuest site.** It would add
  around two thousand lines (the card drawing, the zip and TTS deck building,
  the Steam Cloud steps) to a site that is already one large page, and leave
  two copies to keep in step. It also would not avoid the Steam Cloud upload
  step, which is a limit of TTS, and the pasted links would be remembered
  separately on each site.
- **Rejected: capturing the sheet's HTML tiles as pictures.** The tiles grow
  with their text, so they don't fit a fixed card shape, and page capture
  struggles with web fonts and the sheet's zoom.
- **Rejected: Card Builder reading the site's character save file.** Card
  Builder would need its own copy of FlagonQuest's rules for builds, picks and
  bonuses, which would drift from the site.

**One accent color, not one per archetype.** Techniques often belong to
several archetypes at once ("Duelist, Rogue, Monk"), so coloring by archetype
wouldn't be meaningful. The frame uses the site's gold throughout.

Builder-only columns (prereq check syntax, feature budgets, builder notes,
base item options, crafting notes and so on) are left off the card and the
hover text, since they drive the site's character builder rather than play at
the table.

### The Allies layout (draft)

A card game with two kinds of card, allies (characters) and the actions they
take, in one layout. The ally card is drafted first; actions come next.

An ally has a type ("Ally"), tags (creature and fighter types), Armor,
Health, Resists, Immunities, ability text, and an Aura. From top to bottom the
card reads: name, art, the text box (Resists and Immunities, then abilities and
flavor), the type line ("Ally — Human · Knight"), and a bottom row with Armor
and Health badges in the corners, like power and toughness, and the Aura as
colored boxes between them. The user chose this order: type, tags and stats
together at the bottom, with the text between them and the art. The name bar,
type line and text box are slightly see-through, so the Aura's colors show
behind them as well as around the edges.

**The Aura colors the card.** The Aura lists up to four types, each with a
color: Instinct green, Knowledge blue, Passion red and Discipline white. The
card's background blends them, with each one's number setting its share of the
card ("Knowledge 2, Passion 1" is two-thirds blue). Without numbers, they share
equally; an ally with no Aura gets a plain stone gray. An Aura marked Inverted
("Inverted Passion" or "Passion (Inverted)") blights its share: the same color,
duller and darker with a bilious cast, and veined with dark lines, so it reads
as an evil version of that Aura. (A first version turned the share nearly
black; the user wanted it closer to the original color.) The Aura also appears as colored boxes in the bottom row (an
Inverted one in its blighted color), so it can be read as well as seen.

**Five blend styles, chosen per card.** The user liked all five styles in the
mockups: a soft gradient, hard diagonal stripes, a tie-dye spiral, marbling,
and a solid fill in the strongest color. A `blend` column picks one per card,
and gradient is the default. Every style gives each color exactly its share of
the area. The swirl and marble patterns are seeded by the card's name, so a
card always looks the same but two cards with the same Aura don't look
identical. Colored gems showing the mix were also mocked up and dropped,
because the Aura chips already say it. A page-level dropdown to switch the
whole deck's style at once was offered and isn't built yet.

The color blending is general: the layout says which words are colors and
which words change a color, and the renderer draws any weighted list that way.
So another layout can blend its own list of colors without new code.

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

## Cards sent in a link

Another site can open Card Builder with cards already loaded, by putting them
in the link after `#import=`. The data is a small table (column names and
rows, like a spreadsheet), compressed and encoded to fit in a link, plus an
optional title and layout. Browsers never send the part of a link after `#` to
the server, so the cards stay on the player's computer. A whole character is
a few kilobytes, well within what links can hold. When the sending site sends
again into the same tab, Card Builder loads the new cards. A damaged link, or
one from a newer version of the sending site, shows a warning instead of
failing. The FlagonQuest site is the first sender.

- **Rejected: sharing browser storage between the sites.** They are on
  different web addresses, so browsers keep their storage apart.
- **Rejected: messages between open tabs.** It needs both pages open and
  waiting for each other, which is more fragile than a link that simply works
  when opened.

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

**Blank templates.** The Templates & examples tab has a blank CSV template
for every layout. The template's columns are worked out
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
- **Image names change whenever an image changes.** TTS caches images by
  address, so reusing a name would keep showing the old art after an update.
  "This computer" and "My own website" put the download time in each name.
  Steam Cloud names carry a fingerprint (hash) of the image itself, which lets
  pasted links be reused (see below).
- **Two resolutions:** High keeps full 300 DPI cards (a full sheet stays under
  8192 pixels), and Compatible scales sheets to 4096 pixels for older graphics
  cards.

TTS loads images from addresses, so the export asks how TTS will get the
images.

**Standing goal: as easy as possible for the end user, with no infrastructure.**
People making cards shouldn't need a GitHub repository, a web host or any other
setup to share a deck with friends. The ideal is instructions as simple as "do
this in TTS, then paste these links here."

There are three options, and Steam Cloud is the default:

- **Steam Cloud (recommended).** Every TTS player has free Steam Cloud storage,
  and only TTS itself can upload to it, so the flow goes back and forth once:
  1. Card Builder gives a ZIP of just the images to upload. They can be
     unzipped anywhere, since TTS's own file picker reads them.
  2. In TTS's Cloud Manager (Upload → Cloud Manager), the player uploads them.
     Clicking an uploaded file copies its link.
  3. The player pastes each link next to the matching file name in Card
     Builder.
  4. Card Builder builds the deck with those links, so the cards keep their
     names, hover text and copy counts, and everyone in the game sees the art.

  To keep repeat use easy, each image's file name includes a fingerprint of
  its content, and pasted links are remembered by fingerprint in the browser.
  After a page reload, or after changing a few cards, any image that is still
  the same gets its link back automatically, so only changed images need
  uploading again. Identical images, such as one card back shared by several
  decks, are uploaded once. If the cards change after the images were
  downloaded, the deck download waits until the images are downloaded again,
  so a deck can't silently point at outdated pictures.

  Rejected alternatives:
  - *TTS's "Upload All" button in the Cloud Manager.* It uploads a game's
    local images and switches them to cloud links, which would keep names and
    counts. But it needs the deck to load from local files first, and that
    failed on Linux.
  - *TTS's own deck import with "Cloud" chosen.* It is simple and works
    everywhere, but the cards arrive unnamed, with no hover text and one copy
    of each.
  - *Hosting the images on a website (GitHub Pages and so on).* It works well
    but needs exactly the kind of setup the goal rules out. It stays available
    as "My own website" for people who already have hosting.
- **This computer only:** the player gives their Saved Objects folder path, and the
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
- **My own website:** the player gives a web address and uploads the images
  there. This works for online play, for people who already have hosting.

**Loading instructions live on the page.** The TTS export tab walks through
the whole job as numbered steps, each with a short heading and plain
sentences: for Steam Cloud, download the pictures, upload them in TTS, paste
their links, download the deck; then, for every option, "Put the deck into
TTS" (unzip, move the folder, open it from the Objects menu). The page scrolls
to those steps after a TTS download. The steps show only what applies to the
chosen option and fill in the folder or web address that was typed. Common
problems (an extra folder from unzipping, blank cards, a TTS version with a
differently named menu, updating a deck) sit in a collapsible "If something
goes wrong" section, so they don't crowd the main steps. The same steps also
ship inside the ZIP as `HOW TO IMPORT.txt`.

The user asked for this guidance to be simple and easy to follow even if it
gets longer, so it favors one action per line and explains what to expect
(for example, that clicking a picture in the Cloud Manager copies its link
without any visible sign). Instructions call the files "pictures" and use
TTS's own menu names. The Cloud Manager steps follow TTS's official knowledge
base: **Upload → Cloud Manager**, the folder icon to the left of its search
bar uploads a file, and clicking an uploaded file copies its link.

Card hover descriptions in TTS include the type, subtype and tags, the cost,
the rules text, the stats and the flavor text. Any other filled-in column is
listed by its column name (for example "Strengf 4 · Helf 3 · Steal 2"). That
way a layout's own stats show up on hover without the TTS export needing to
know about them. A layout can instead list exactly what goes on hover, and
with which labels. FlagonQuest techniques do this, because their spreadsheet
has around thirty columns, most of them only for the site's character builder.

## The page

The page has a narrow sidebar on the left and tabs on the right. The sidebar
holds only the three things every visit needs, in order:

1. **Your files:** one row each for the spreadsheet, the card art and the card
   back, with a check mark and a short status ("5 images · all cards
   matched"). Files can be dropped anywhere on the page, or on a row to pick
   what kind they are. A collapsible Tips section holds the reminders.
2. **Look:** the layout and card size pickers, side by side.
3. **Download:** a button for the TTS deck and one for card images.

The tabs on the right are **Cards** (the preview), **Data** (the spreadsheet as
it was read: one row per card, which header became which column, and whether
each card found its art), **TTS export** (the image options, the Steam Cloud
steps and link boxes, and the loading guide) and **Templates & examples**
(examples to load or download, a blank template per layout, and the column
reference). Loading a spreadsheet or an example brings the Cards tab forward,
unless the Data tab is open.

This replaced a five-step sidebar in which every step carried its own rows of
small links (examples, example downloads, the column list, the template, the
folder picker, "clear" links) and the whole TTS form. Once the process had
settled, those links made the sidebar hard to scan. Explanations and links
still exist, but they live in a collapsible section or on a tab, not in the
sidebar's main flow.

- **Rejected: a step-by-step wizard** (Files → Look → Download, one step
  showing at a time). It is the most guided option, but it adds clicks for the
  common case of coming back to change a layout and download again.
- **Rejected: a toolbar with a slide-out download drawer and no sidebar.** It
  gives the cards the most room, but less is visible at a glance, and the
  Steam Cloud steps would be hidden in a drawer.

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
