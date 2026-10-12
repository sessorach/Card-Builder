# Card Builder

Make card images and Tabletop Simulator decks from a spreadsheet, right in
your browser: **https://sessorach.github.io/Card-Builder/**

## How to use it

1. **Drop in your spreadsheet** (`.csv` or `.xlsx`), one row per card.
2. **Drop in your card images**, each named after its card
   (`Battle Maneuver.png`). You can drop a whole folder at once.
3. **Drop in a card back** (optional).
4. **Pick a layout.**
5. **Download** one of:
   - **Card images:** a ZIP with one picture per card.
   - **TTS deck:** a ZIP with each deck ready for Tabletop Simulator,
     including the number of copies from your spreadsheet. Unzip it into your
     TTS `Saved Objects` folder, then find it in-game under
     *Objects → Saved Objects → Card Builder*. Step-by-step help is in the
     page's **TTS export** tab.

Not sure where to start? The **Templates & examples** tab has a blank CSV
template for each layout and example decks to load.

## Spreadsheet tips

- Only `name` is required. `count` sets how many copies go in the TTS deck,
  and `deck` splits cards into separate decks.
- Card text can use `**bold**`, `*italic*` and line breaks.
- The **Data** tab shows your spreadsheet as the page read it, and which cards
  are missing art.
- The column list is in the **Templates & examples** tab.
- FlagonQuest players can drop in the techniques or items spreadsheet from
  the FlagonQuest repo as-is; the page picks the FlagonQuest layout by itself.
  To make cards for one character, use **Make cards** on the FlagonQuest
  Character Sheet: it opens this page with that character's cards loaded.
- New to RossQuest? The **Templates & examples** tab has a step-by-step
  RossQuest guide, including how the Aura colors work.

## Playing with friends

Leave the TTS option on **Steam Cloud** (the default). The page walks you
through it: download the pictures, upload them in TTS (*Upload → Cloud
Manager*), and paste their links back into the page. Then everyone in your game
sees the cards. Links are remembered, so next time only changed pictures need
uploading.
