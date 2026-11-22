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

StoryKeys is a Vite + TypeScript + Tailwind CSS app. You need [Node.js](https://nodejs.org/) 22.6 or later.

```bash
npm install
npm run dev
```

Then open the URL Vite prints (usually `http://localhost:5173`).

| Script | What it does |
| --- | --- |
| `npm run dev` | Start the local development server |
| `npm run build` | Type-check and create a production build in `dist/` |
| `npm run preview` | Preview the production build locally |
| `npm test` | Run unit tests via Node's built-in test runner |
| `npm run check:data` | Validate curriculum and badge JSON schemas and IDs |
| `npm run check:contrast` | Assert WCAG AA contrast across every theme colour pair |
| `npm run check` | Run data validation, contrast check, and unit tests |
| `npm run check:smoke` | Drive the app and audit dashboard in headless Chromium |
| `npm run shots` | Screenshot every screen, modal and breakpoint into `shots/` |

`check:smoke` and `shots` require Chrome, Chromium, or Edge installed locally and automatically start an
ephemeral Vite server if one is not already listening on `http://localhost:5173`. Override browser path,
base URL, or DevTools port with `SK_CHROME`, `SK_BASE`, or `SK_PORT` if needed.

## Project Structure

```
StoryKeys/
├── index.html              # Main Vite entry / application shell
├── audit.html              # Content audit dashboard entry
├── vite.config.ts
├── package.json
├── src/
│   ├── main.ts             # Init, top-level navigation, home/summary binding
│   ├── types.ts            # Shared domain types & discriminated unions
│   ├── state.ts            # State, sanitisation, save/load
│   ├── draft.ts            # Draft localStorage helpers
│   ├── config.ts           # Constants & localStorage keys
│   ├── utils.ts            # Text normalisation, escaping, DOM helpers
│   ├── audit/main.ts       # Typed content audit & PDF export controller
│   ├── data/loader.ts      # Lazy-load curriculum JSON
│   ├── session/            # Lesson lifecycle, typingController, keyboard, stats
│   ├── progress/           # Progress helpers and pure badge evaluation
│   ├── audio/sounds.ts     # Web Audio + Speech Synthesis TTS
│   ├── ui/                 # Screens, modals, modalController, picker, classes
│   └── styles/app.css      # Tailwind + theme tokens + local @font-face
├── public/
│   ├── data/               # Curriculum & badge JSON (served at /data/...)
│   ├── fonts/              # Self-hosted OpenDyslexic WOFF2 fonts
│   └── audit/              # Audit dashboard styles
├── tests/                  # Node unit tests for domain logic
└── tools/                  # Data validator, contrast check, smoke test, screenshots
```

## Adding Content

All content lives in JSON files under `public/data/` - no code changes required. Both the app and the audit dashboard read from `public/data/` (fetched at `data/copy.json`, `data/KS2/passages.json`, and so on). Run `npm run check:data` after editing content to verify schemas and unique IDs.

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
  "id": "spelling_ks1_tricky_words_1",
  "stage": "KS1",
  "theme": "Common Exception Words",
  "name": "KS1 Tricky Words",
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
