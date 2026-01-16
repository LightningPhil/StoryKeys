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

- Themes: Light, Dark, Cream
- Fonts: System default, Arial, OpenDyslexic
- Letter spacing: 0-8px
- Line height: 1.4-2.0
- Toggle timer display, keyboard guide, finger guide, sounds, and animations

### Privacy

- 100% offline after initial load
- No user accounts
- Progress stored in browser localStorage only
- No analytics or tracking
- Export or delete data anytime via Parent Glance

## Getting Started

StoryKeys uses ES6 modules, so it must be served via HTTP rather than opened directly as a file.

## Project Structure

```
StoryKeys/
├── index.html          # Application shell
├── styles.css          # All styling
├── src/
│   ├── main.js         # App controller and state
│   ├── ui.js           # HTML rendering
│   ├── lessons.js      # Session lifecycle
│   ├── keyboard.js     # Typing input handling
│   ├── stats.js        # WPM and accuracy calculation
│   ├── badges.js       # Badge awarding logic
│   ├── sounds.js       # Audio and text-to-speech
│   ├── progress.js     # Progress tracking
│   ├── dataLoader.js   # Lazy-loading JSON data
│   ├── config.js       # Configuration constants
│   └── utils.js        # Helper functions
└── data/
    ├── KS1/            # Key Stage 1 content
    ├── KS2/            # Key Stage 2 content
    ├── KS3/            # Key Stage 3 content
    ├── KS4/            # Key Stage 4 content
    ├── spelling.json   # Statutory spelling lists
    ├── phonics.json    # Phonics exercises
    ├── badges.json     # Badge definitions
    ├── copy.json       # UI text
    └── keymap.json     # Keyboard layout
```

## Adding Content

All content lives in JSON files - no code changes required.

### Add a Passage

Edit `data/KS2/passages.json`:

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

Edit `data/spelling.json`:

```json
{
  "stage": "KS1",
  "words": ["the", "said", "have", "like", "some"]
}
```

## Tech Stack

Intentionally simple and dependency-free:

- HTML5, CSS3, vanilla JavaScript (ES6 modules)
- Web Audio API for synthesised sounds
- Speech Synthesis API for read aloud
- localStorage for progress
- No frameworks, no build tools, no npm

## Browser Support

- Chrome/Edge 88+
- Firefox 85+
- Safari 14+

## Contributing

Contributions welcome. Add passages, fix typos, or improve accessibility. Fork the repo, make changes, and open a pull request.

## License

MIT License - see LICENSE for details.

Copyright (c) 2025 Philip Leichauer
