# StoryKeys

A calm, dyslexia-friendly typing tutor for young learners.

StoryKeys helps children build confident typing skills through short stories, spelling practice, and phonics exercises - all aligned with UK Key Stages 1-4. It runs entirely in the browser with no accounts, no tracking, and no data leaving the device.

## Why StoryKeys?

Traditional typing tutors can feel stressful - flashing timers, loud error sounds, and overwhelming interfaces. StoryKeys takes a different approach:

- **Calm, not chaotic** - Soft colours, gentle sounds, and a timer that waits for the learner
- **Accessible by design** - Built for dyslexic learners with customisable fonts, spacing, and visual guides
- **Privacy-first** - No accounts, no cloud, no tracking. Everything stays on the device
- **Curriculum-aligned** - UK Key Stages 1-4 with statutory spelling lists

## Features

### Dyslexia-Friendly Design

- **OpenDyslexic font** option with weighted bottoms to anchor letters
- **Adjustable spacing** for letters and lines
- **Focus line** highlights the current line to reduce visual overload
- **Read aloud** with adjustable voice and speed
- **Finger guide** shows which finger to use for each key
- **Lockstep mode** requires corrections before continuing
- **Calm timer** only starts on first keypress
- **Reduce motion** option disables animations

### UK Curriculum Content

- **Key Stage 1** (Ages 5-7) - Simple sentences, common exception words, basic phonics
- **Key Stage 2** (Ages 7-11) - Longer passages, statutory spellings, subject vocabulary
- **Key Stage 3** (Ages 11-14) - Academic passages, subject terminology
- **Key Stage 4** (Ages 14-16) - Exam-style texts, technical vocabulary

Content types include passages (stories by theme), spelling tutor (statutory lists), phonics (pattern exercises), and word sets (subject vocabulary).

### Progress and Motivation

- Streak counter for consecutive practice days
- 50+ badges across practice, accuracy, speed, and streak tracks
- Personal best comparisons
- WPM sparkline showing speed throughout each lesson
- Focus drills targeting tricky letters and words
- Printable certificates

### Customisation

- Themes: Cream, Light, Dark - all meeting WCAG AA contrast
- Fonts: System default, Arial, OpenDyslexic
- Letter spacing and line height adjustable
- Toggle timer display, keyboard guide, finger guide, sounds, and animations

### Privacy

- 100% offline after initial load
- No user accounts
- Progress stored in browser localStorage only (`storykeys_state`, `storykeys_draft`)
- No analytics or tracking
- Export or delete data anytime via Parent Glance

## Getting Started

StoryKeys is a Vite + TypeScript + Tailwind CSS app. You need [Node.js](https://nodejs.org/) 20 or later.

```bash
npm install
npm run dev
```

Then open the URL Vite prints (usually `http://localhost:5173`).

| Script | What it does |
| --- | --- |
| `npm run dev` | Start the local development server |
| `npm run build` | Type-check, create a production build in `dist/`, and publish it to the repo root for GitHub Pages |
| `npm run preview` | Preview the production build locally (open the `/StoryKeys/` path) |
| `npm run check:contrast` | Assert WCAG AA contrast across every theme colour pair |
| `npm run check:smoke` | Drive the app in headless Chrome and check the UI still works |
| `npm run shots` | Screenshot every screen, modal and breakpoint into `shots/` |

The last three need Chrome installed; the two that drive the browser also need `npm run dev` running in
another terminal. Override the defaults with `SK_CHROME`, `SK_BASE` or `SK_PORT` if needed.

GitHub Pages serves this repository from the `main` branch root, so it needs a compiled
`index.html` plus bundled JavaScript and CSS. `npm run build` writes those files to the
repo root (`index.html`, `audit.html`, `assets/`, `audit/`, `.nojekyll`). Commit them
with your source changes. Edit the HTML shells in `dev/`, not the generated root copies.

## Project Structure

```
StoryKeys/
├── index.html              # Compiled app shell (GitHub Pages; generated)
├── audit.html              # Compiled audit dashboard (generated)
├── assets/                 # Compiled JS/CSS (generated)
├── .nojekyll               # Stop GitHub Pages running Jekyll on the build
├── dev/
│   ├── index.html          # Vite entry / application shell
│   └── audit.html          # Audit dashboard (second Vite entry)
├── vite.config.ts
├── package.json
├── src/
│   ├── main.ts             # Init, routing, event binding
│   ├── types.ts            # Shared domain types
│   ├── state.ts            # State, save/load
│   ├── draft.ts            # Draft localStorage helpers
│   ├── config.ts
│   ├── utils.ts
│   ├── data/loader.ts      # Lazy-load JSON
│   ├── session/            # Lesson lifecycle, keyboard, stats
│   ├── progress/           # Progress helpers and badges
│   ├── audio/sounds.ts     # Web Audio + TTS
│   ├── ui/                 # Screens, modals, picker, feedback
│   └── styles/app.css      # Tailwind + small custom CSS
├── public/
│   ├── data/               # Curriculum JSON (served at /data/...)
│   └── audit/              # Audit dashboard script and styles
├── tools/                  # Contrast check, smoke test, screenshot, Pages publish
└── data/                   # Curriculum JSON copied to the repo root for GitHub Pages
```

## Adding Content

All content lives in JSON files - no code changes required. Edit files under `public/data/`; `npm run build` copies them to the root `data/` folder that GitHub Pages serves. Fetch paths stay `data/copy.json`, `data/KS2/passages.json`, and so on.

### Add a Passage

Edit `public/data/KS2/passages.json`:

```json
{
  "id": "ks2_animals_hedgehog_1",
  "stage": "KS2",
  "theme": "Animals",
  "title": "The Helpful Hedgehog",
  "text": "Henry the hedgehog loved helping his friends."
}
```

### Add Spelling Words

Edit `public/data/spelling.json`:

```json
{
  "stage": "KS1",
  "words": ["the", "said", "have", "like", "some"]
}
```

## Tech Stack

- Vite
- TypeScript
- Tailwind CSS
- Web Audio API for synthesised sounds
- Speech Synthesis API for read aloud
- localStorage for progress
- No React, Vue, or backend

## Browser Support

- Chrome/Edge 88+
- Firefox 85+
- Safari 14+

## Contributing

Contributions welcome. Add passages, fix typos, or improve accessibility. Fork the repo, make changes, and open a pull request.

## License

MIT License - see LICENSE for details.

Copyright (c) 2025 Philip Leichauer
