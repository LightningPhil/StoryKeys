# StoryKeys UI Inventory & Rules

This document describes the UI structure, components, and rules for maintaining consistency in the StoryKeys codebase.

---

## Screens

| Screen Name | ID/Selector | Description |
|-------------|-------------|-------------|
| **home** | `#home-screen` | One primary action for the learner's own key stage, with the other stages behind a `<details>` disclosure; an Explore card (all lessons + badges); and a combined progress/streak card |
| **typing** | `#typing-screen` | Exit button, lesson title and timer; a helper row (read aloud, lockstep, focus line, caps); labelled "Read this" and "Type here" panels; optional finger guide and on-screen keyboard |
| **summary** | `#summary-screen` | Results display with metrics, badges earned, and navigation buttons |

---

## Modals

| Modal Name | Role | Aria Label ID | Description |
|------------|------|---------------|-------------|
| **welcome** | dialog | `#welcome-title` | First-time user intro |
| **help** | dialog | `#help-title` | How-to-use guide with privacy info |
| **badges** | dialog | `#badges-title` | Earned badges display |
| **lessonPicker** | dialog | `#lesson-picker-title` | Full lesson browsing with tabs, filters, search, pagination |
| **settings** | dialog | `#settings-title` | Readability, behaviour, and privacy settings |
| **parent** | dialog | `#parent-title` | Parent/teacher dashboard with stats |
| **pin** | dialog | `#pin-title` | PIN entry for parent protection |

---

## Shared UI Components

Shared class strings live in `src/ui/classes.ts`. Screens and modals compose Tailwind utilities from there.

### Buttons
- Compose with `buttonClass(...)`, never by hand
- Colour variants: `primary`, `secondary`, `quiet`, `danger`, `phonics`, `spelling`
- Size/shape modifiers: `sm`, `lg`, `block`
- Icon buttons: `ui.iconButton`
- Containers: `ui.buttonGroup`, `ui.buttonRow`, `ui.buttonRowCenter`, `ui.stageRow`
- The base includes `min-h-12` so every control stays a comfortable touch target. Keep it.

### Cards
- Base: `ui.card` (or `ui.cardTight` for denser rows)
- Add `ui.tile` for cards that behave like buttons and should lift on hover

### Toggle Switch
- Class: `.toggle-switch` (custom CSS for the slider)
- The `<input>` must be **immediately followed** by `<span class="slider">` — the CSS relies on
  `input:checked + .slider`. Put label text either before the input (visually hidden) or after the slider.
- Structure: `<label class="toggle-switch"><input type="checkbox"><span class="slider"></span><span>Label</span></label>`

### Modal Structure
Every modal uses `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, a header with close button, and a footer when actions are needed.

**The literal class names `modal` and `modal-content` are load-bearing.** `showModal()` finds the dialog
with `querySelector('.modal')`, the stylesheet reveals it with `.modal.active`, and `bindModalEvents()`
finds `.modal-content` to wire the close button and focus trap. They live in `ui.modal` / `ui.modalContent`
alongside the Tailwind utilities — dropping them silently breaks every modal while still locking page
scroll. The same applies to `card`, which `.show-confetti .card` depends on.

---

## Rules

1. **Render purity** — `getScreenHtml()` and `getModalHtml()` return HTML strings only.
2. **Controllers bind events** — `bindScreenEvents()` and `bindModalEvents()` in `src/main.ts`.
3. **Focus** — opening a modal focuses the dialog container so screen readers announce its title, rather
   than landing on the close button. A modal that wants a specific field focused marks it `data-autofocus`.
   Tab then cycles inside the modal; Escape closes; focus returns to the opener.
4. **localStorage keys** — `storykeys_state` and `storykeys_draft` must stay stable.
5. **Escape hatch from a lesson** — the typing screen needs a visible way out (`#exit-lesson-btn`); it saves
   a draft before leaving.

---

## Colour and Accessibility Rules

Themes are defined as custom properties on `.theme-cream` / `.theme-light` / `.theme-dark` in
`src/styles/app.css`. Use the tokens, not raw hex values, in component code.

- **No pure white or pure black surfaces.** The British Dyslexia Association style guide advises off-white
  or tinted grounds, which is why `--sk-card` is warm off-white rather than `#ffffff`.
- **Never put `text-white` on an accent fill.** The dark theme's accent is a light blue, so filled controls
  read `--sk-on-accent` (near-black there, white elsewhere). Same for `--sk-on-bad`.
- **Avoid red and pink for positive feedback** — they are hard for colour-blind readers and read as
  warnings. Celebrations use `--sk-warm` (amber).
- **Never signal state by colour alone.** Correct letters gain weight as well as colour; errors keep their
  wavy underline.
- **Animations must respect motion preferences** — both `prefers-reduced-motion` and the in-app
  `.reduce-motion` class already blanket-disable animation and transition.

Run `npm run check:contrast` after touching any colour token; it parses the real values out of the
stylesheet and asserts WCAG AA on every foreground/background pair the UI actually composes.

---

## Quick Reference: Where Things Live

| What | File |
|------|------|
| Tailwind + custom CSS | `src/styles/app.css` |
| Screen rendering | `src/ui/screens.ts` |
| Modal rendering | `src/ui/modals.ts` |
| Lesson picker | `src/ui/picker.ts` |
| Screen/modal events | `src/main.ts` |
| State | `src/state.ts` |
| Typing input | `src/session/keyboard.ts` |
| Session lifecycle | `src/session/lessons.ts` |
| Progress | `src/progress/progress.ts` |
| Contrast check | `tools/contrast.mjs` (`npm run check:contrast`) |
| Functional smoke test | `tools/smoke.mjs` (`npm run check:smoke`) |
| Screenshot capture | `tools/screenshot.mjs` (`npm run shots`) |

The two check scripts need a dev server running (`npm run dev`) and drive headless Chrome. Point them at
another browser or port with `SK_CHROME`, `SK_BASE` and `SK_PORT` if the defaults do not match your machine.
