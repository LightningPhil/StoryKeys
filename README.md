# StoryKeys

**A calm, dyslexia-friendly typing tutor for young learners.**

StoryKeys helps children build confident typing skills through short stories, spelling practice, and phonics exercises — all aligned with UK Key Stages 1–4. It runs entirely in the browser with no accounts, no tracking, and no data leaving the device.

![License](https://img.shields.io/badge/license-MIT-blue.svg)

---

## ✨ Features

### 🎯 Designed for Young Learners
- **Dyslexia-friendly** — OpenDyslexic font option, adjustable letter/line spacing, and a clean focus-line highlight
- **Calm pacing** — Timer only starts when the child presses their first correct key, giving time to read or listen
- **Read aloud** — Built-in text-to-speech reads passages aloud before typing begins
- **Gentle feedback** — Soft audio cues for correct/incorrect keystrokes (can be toggled off)

### 📚 UK Curriculum Aligned
- **Key Stages 1–4** content with age-appropriate vocabulary and complexity
- **Passages** — Short stories organised by theme (animals, adventure, science, etc.)
- **Spelling Tutor** — Statutory spelling lists for each Key Stage
- **Phonics** — Pattern-based exercises for early readers
- **Word Sets** — Subject-specific vocabulary drills

### 📊 Progress & Motivation
- **Streak counter** — Tracks consecutive days of practice
- **Badges** — Milestone awards for words typed, accuracy, and more
- **Focus Drills** — Automatic practice targeting tricky letters and words
- **Session stats** — WPM, accuracy, and comparison to personal best
- **Printable certificates** — Celebrate achievements

### ⚙️ Fully Customisable
- **Themes** — Light, dark, and cream colour schemes
- **Fonts** — System default or OpenDyslexic
- **Spacing** — Adjustable letter and line spacing
- **Sounds** — Toggle typing sounds on/off
- **On-screen keyboard** — Optional visual guide

### 🔒 Privacy First
- **100% offline** after initial load — no server calls
- **No accounts** — progress stored in browser localStorage
- **No analytics** — zero tracking or data collection

---

## 🚀 Getting Started

Because StoryKeys uses ES6 modules, it must be served via HTTP (not opened directly as a file).

### Option 1: VS Code Live Server (Recommended)

1. Install the **Live Server** extension in VS Code
2. Open the project folder
3. Right-click `index.html` → **Open with Live Server**

### Option 2: Python

```bash
cd StoryKeys
python -m http.server 8000
# Open http://localhost:8000
```

### Option 3: Node.js

```bash
npx serve .
# Open http://localhost:3000
```

### Option 4: IIS (Windows)

1. Create a new Application pointing to the project folder
2. Ensure the App Pool identity has **Read** permissions
3. Set `index.html` as the default document

---

## 📂 Project Structure

```
StoryKeys/
├── index.html          # Application shell
├── styles.css          # All styling
│
├── src/
│   ├── main.js         # App controller & state
│   ├── ui.js           # HTML rendering
│   ├── lessons.js      # Session lifecycle
│   ├── keyboard.js     # Typing input handling
│   ├── stats.js        # WPM & accuracy calculation
│   ├── badges.js       # Badge awarding logic
│   ├── sounds.js       # Audio & text-to-speech
│   ├── progress.js     # Progress tracking
│   ├── dataLoader.js   # JSON data loading
│   ├── config.js       # App configuration
│   └── utils.js        # Helper functions
│
└── data/
    ├── KS1/ KS2/ KS3/ KS4/   # Stage-specific content
    │   ├── passages.json
    │   ├── patterns.json
    │   └── wordsets.json
    ├── spelling.json         # Statutory spelling lists
    ├── phonics.json          # Phonics passages
    ├── badges.json           # Badge definitions
    ├── copy.json             # UI text & messages
    └── keymap.json           # Keyboard layout data
```

---

## ✍️ Adding Content

All lesson content lives in JSON files — no code changes required.

### Add a New Passage

Edit `data/KS2/passages.json` (or the appropriate stage):

```json
{
  "id": "ks2_animals_hedgehog_1",
  "stage": "KS2",
  "theme": "Animals",
  "title": "The Helpful Hedgehog",
  "text": "Henry the hedgehog loved helping his friends. Every morning, he would collect berries for the birds.",
  "tags": {
    "complexity": { "caps": true, "punct": true }
  }
}
```

The lesson appears automatically on next load.

### Add Spelling Words

Edit `data/spelling.json`:

```json
{
  "stage": "KS1",
  "words": ["the", "said", "have", "like", "some"]
}
```

---

## 💻 Tech Stack

Intentionally simple and dependency-free:

- **HTML5** — Semantic markup
- **CSS3** — Custom properties for theming
- **Vanilla JavaScript** — ES6 modules
- **JSON** — All content and configuration
- **Web Audio API** — Sound effects
- **Speech Synthesis API** — Text-to-speech

No frameworks. No build tools. No npm dependencies.

---

## 🗺️ Roadmap

- [ ] Parent/teacher dashboard
- [ ] Multiplayer races
- [ ] Custom lesson creator
- [ ] Mobile touch keyboard support
- [ ] Export progress data

---

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.

---

Built with ❤️ for young learners.