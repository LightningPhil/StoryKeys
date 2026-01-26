# Spelling Recall Mode (Advanced) - Implementation Plan

## Goals
- Keep the current spelling tutor behavior unchanged.
- Add an optional recall mode with a memorize phase, a visible 10s countdown, and per-word spoken prompts.
- Randomize word order so it cannot be learned as a fixed list.

## UX Flow (Recall Mode)
1. User selects a spelling lesson and chooses Recall mode (Tutor mode stays the default).
2. Show the full word list and allow unlimited time to memorize.
3. Read Aloud plays the full list in this phase.
4. User clicks Ready; words vanish and a 10-second countdown starts.
5. After the countdown, the Say word button becomes active.
6. Each time Say word is pressed, the next word is spoken and input unlocks.
7. When the word is entered, input locks again until Say word is pressed for the next word.
8. After the final word, end the session and show the standard summary.

## Tasks
- [x] Add a spelling mode chooser (Home and lesson picker) so users can pick Tutor or Recall without changing existing defaults.
- [x] Extend session setup in `src/lessons.js` to support `lesson.mode === 'recall'`:
  - Shuffle words with a Fisher-Yates helper (add in `src/utils.js`).
  - Build `targetText` from the shuffled list for scoring.
  - Store recall state in `state.runtime.spellingRecall` (phase, order, current index, typed buffer, countdown).
- [x] Update typing screen HTML in `src/ui.js` to render recall controls:
  - Read Aloud button stays.
  - Add Ready, Say word, countdown display, and a brief instruction panel.
  - Show these elements only when `lesson.mode === 'recall'`.
- [x] Add recall event handling in `src/main.js`:
  - Ready starts the 10s countdown, hides the word list, disables Say word until 0.
  - Say word speaks the next word and unlocks input.
  - Lock Say word while speech is playing.
- [x] Implement recall input handling (new handler or branch in `src/keyboard.js`):
  - Enforce per-word input length and optional lockstep behavior.
  - When a word is complete, append it (plus newline) to a typed buffer, lock input, and enable Say word.
  - When the last word completes, call `endSession` with the full typed buffer.
- [x] Update progress bar and draft saving in `src/main.js` to use `typedBuffer + input.value` for recall mode so progress and resume are accurate.
- [x] Add recall-specific styles in `styles.css`:
  - Hide the word list after Ready (use `visibility` or `opacity` so layout stays stable).
  - Style the countdown badge and Say word button state.
- [x] Add copy strings for new UI labels in `data/copy.json`.

## Edge Cases
- Speech not available: disable Read Aloud and Say word with a clear tooltip.
- Leaving/restarting: stop speech, clear countdown timers, and reset recall state cleanly.
- Randomization: shuffle per session only; never mutate the source data list.

## Manual Test Checklist
- Start a spelling lesson in Tutor mode; behavior remains unchanged.
- Start Recall mode: list shows, Read Aloud reads all words, Ready hides list and starts 10s countdown.
- Say word only works after countdown; each press speaks the correct next word.
- Input locks between words and advances only after completion and pressing Say word again.
- Session ends after the last word with normal summary stats and badges.
