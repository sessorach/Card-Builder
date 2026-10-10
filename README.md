# Card Builder

Make card images and Tabletop Simulator decks from a spreadsheet, right in
your browser: **https://sessorach.github.io/Card-Builder/**

## How to use it

1. **Drop in your spreadsheet** (`.csv` or `.xlsx`), one row per card.
2. **Drop in your card images**, each named after its card
   (`Block Party Boss.png`). You can drop a whole folder at once.
3. **Drop in a card back** (optional).
4. **Pick a layout.**
5. **Download** one of:
   - **Card images:** a ZIP with one picture per card.
   - **TTS deck:** a ZIP with each deck ready for Tabletop Simulator,
     including the number of copies from your spreadsheet. Unzip it into your
     TTS `Saved Objects` folder, then find it in-game under
     *Objects → Saved Objects → Card Builder*. Step-by-step help is on the
     page, under the download button.

Not sure where to start? Pick a layout and download its blank CSV template
(the link is under the layout picker), or load one of the examples on the page.

## Spreadsheet tips

- Only `name` is required. `count` sets how many copies go in the TTS deck,
  and `deck` splits cards into separate decks.
- Card text can use `**bold**`, `*italic*` and line breaks.
- The **Columns** link on the page lists every column a layout uses.
- FlagonQuest players can drop in the techniques or items spreadsheet from
  the FlagonQuest repo as-is; the page picks the right layout by itself.

## Playing with friends

Leave the TTS option on **Steam Cloud** (the default). The page walks you
through it: download the card images, upload them in TTS's Cloud Manager, and
paste their links back into the page. Then everyone in your game sees the
cards. Links are remembered, so next time only changed images need uploading.
