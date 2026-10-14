# Card Builder

Make card images and Tabletop Simulator decks from a spreadsheet, right in
your browser: **https://sessorach.github.io/Card-Builder/**

## How to use it

1. **Pick a look.** The page shows a sample of each; click one to see
   example cards in it, and switch looks any time.
2. **Get the template.** The **Template & guide** tab has a blank spreadsheet
   for the look you picked, its examples, and what every column does. Or skip
   the spreadsheet: the **Card maker** tab has boxes to fill in, one card at a
   time, with the card drawn as you type, and turns your cards into a
   spreadsheet for you.
3. **Drop in your spreadsheet** (`.csv` or `.xlsx`), one row per card.
4. **Drop in your card images**, each named after its card
   (`Battle Maneuver.png`). You can drop a whole folder at once.
5. **Drop in a card back** (optional).
6. **Download** one of:
   - **Card images:** a ZIP with one picture per card.
   - **TTS deck:** a ZIP with each deck ready for Tabletop Simulator,
     including the number of copies from your spreadsheet. Unzip it into your
     TTS `Saved Objects` folder, then find it in-game under
     *Objects → Saved Objects → Card Builder*. Step-by-step help is in the
     page's **TTS export** tab.

## Spreadsheet tips

- Only `name` is required. `count` sets how many copies go in the TTS deck,
  and `deck` splits cards into separate decks.
- Card text can use `**bold**`, `*italic*` and line breaks.
- The **Data** tab shows your spreadsheet as the page read it, and which cards
  are missing art.
- The columns for each look are explained in the **Template & guide** tab.
- FlagonQuest players can drop in the techniques or items spreadsheet from
  the FlagonQuest repo as-is; the page picks the FlagonQuest layout by itself.
  To make cards for one character, use **Make cards** on the FlagonQuest
  Character Sheet: it opens this page with that character's cards loaded.
- New to RossQuest? Pick it, then open **Template & guide** for a
  step-by-step guide, including how the Aura colors work.

## Playing with friends

Leave the TTS option on **Steam Cloud** (the default). The page walks you
through it: download the pictures, upload them in TTS (*Upload → Cloud
Manager*), and paste their links back into the page. Then everyone in your game
sees the cards. Links are remembered, so next time only changed pictures need
uploading.
