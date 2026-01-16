# StoryKeys UI Inventory & Rules

This document describes the UI structure, components, and rules for maintaining consistency in the StoryKeys codebase.

---

## Screens

| Screen Name | ID/Selector | Description |
|-------------|-------------|-------------|
| **home** | `#home-screen` | Main welcome screen with stage buttons, lesson picker CTA, badges view, and progress card |
| **typing** | `#typing-screen` | Active typing practice with target text, input area, timer, and toggles |
| **summary** | `#summary-screen` | Results display with metrics, badges earned, and navigation buttons |

---

## Modals

| Modal Name | Role | Aria Label ID | Description |
|------------|------|---------------|-------------|
| **welcome** | dialog | `#welcome-title` | First-time user intro |
| **about** | dialog | `#about-title` | App info and license |
| **help** | dialog | `#help-title` | How-to-use guide with privacy info |
| **badges** | dialog | `#badges-title` | Earned badges display |
| **lessonPicker** | dialog | `#lesson-picker-title` | Full lesson browsing with tabs, filters, search, pagination |
| **settings** | dialog | `#settings-title` | Readability, behaviour, and privacy settings |
| **parent** | dialog | `#parent-title` | Parent/teacher dashboard with stats |
| **pin** | dialog | `#pin-title` | PIN entry for parent protection |

---

## Shared UI Components

### Buttons
- **Base class:** `.button`
- **Variants:** `.button-primary`, `.button-secondary`, `.button-danger`, `.button-phonics`, `.button-spelling`
- **Size:** `.button-sm` for smaller buttons
- **Icon buttons:** `.icon-button` (round, icon-only)
- **Containers:** `.button-group`, `.button-row`, `.button-row-center`, `.stage-row`

### Cards
- **Base class:** `.card`
- **Variants:** `.home-card`, `.progress-card`, `.badge-card`

### Toggle Switch
- **Class:** `.toggle-switch`
- Structure: `<label class="toggle-switch">Label<input type="checkbox"><span class="slider"></span></label>`

### Modal Structure
```html
<div class="modal" role="dialog" aria-modal="true" aria-labelledby="[modal-title-id]">
  <div class="modal-content [variant-class]">
    <div class="modal-header">
      <h2 id="[modal-title-id]" class="modal-title">Title</h2>
      <button id="close-modal-btn" class="icon-button">...</button>
    </div>
    <!-- Modal body content -->
    <div class="modal-footer">
      <button class="button button-primary">Action</button>
    </div>
  </div>
</div>
```

---

## Layout Utilities

### Spacing (use CSS variables)
- `--space-xs`: 0.25rem
- `--space-sm`: 0.5rem
- `--space-md`: 1rem
- `--space-lg`: 1.5rem
- `--space-xl`: 2rem

### Utility Classes
| Class | Purpose |
|-------|---------|
| `.stack-sm/md/lg/xl` | Vertical spacing between children |
| `.flex`, `.flex-col`, `.flex-wrap` | Flexbox display |
| `.items-center`, `.justify-center`, `.justify-between` | Flex alignment |
| `.gap-sm/md/lg/xl` | Gap between flex/grid items |
| `.w-full`, `.max-w-420`, `.max-w-md`, `.mx-auto` | Width control |
| `.text-center`, `.text-left` | Text alignment |
| `.mt-sm/md/lg/xl`, `.mb-0/sm/md/lg` | Margin utilities |
| `.hidden` | Hide element |

---

## CSS Organisation

The CSS lives in `styles.css` at the repository root, organised into these sections:

1. **CSS Custom Properties** – Theme variables, spacing scale
2. **Base & Reset** – Box-sizing, html/body defaults
3. **Typography** – Headings, paragraphs, links
4. **Layout Utilities** – Spacing, flexbox, width helpers
5. **Buttons** – Base button, variants, icon buttons, containers
6. **Cards** – Card base and variants
7. **Screen Wrappers** – `.screen` and optional sections
8. **Header & Footer** – App chrome
9. **Modals** – Modal overlay, content, header/footer
10. **Home Screen** – Home-specific styles
11. **Typing Screen** – Target, input, controls
12. **Summary Screen** – Metrics, feedback
13. **Lesson Picker** – Tabs, filters, list, pagination
14. **Settings Modal** – Settings sections and items
15. **Badges** – Badge cards and earned animation
16. **Keyboard Hint** – On-screen keyboard
17. **Effects** – Confetti, toast
18. **Loading Overlay** – Initial load screen

---

## Rules

### 1. No Inline Styles
- ❌ `style="margin-top: 2rem;"`
- ✅ Use utility classes: `class="mt-xl"`
- If a pattern recurs, add a semantic class to CSS.

### 2. Render Purity
- **Render functions must be pure:** No state mutation, no DOM queries, no event binding.
- Functions like `getScreenHtml()` and `getModalHtml()` return HTML strings only.
- State changes happen in controller functions (`showModal`, `showScreen`, `startSession`).
- Event binding happens in `bindScreenEvents()` and `bindModalEvents()`.

### 3. Modal Contract
- Every modal must have:
  - `role="dialog"` and `aria-modal="true"`
  - `aria-labelledby` pointing to the title element
  - `.modal-header` with title and close button
  - `.modal-footer` for action buttons (when applicable)
- Close behaviours:
  - X button closes
  - Escape key closes (handled globally)
  - Click outside closes (click on `.modal` overlay)
- Focus management:
  - Focus moves into modal on open (first focusable element)
  - Tab cycles within modal (focus trap)
  - Focus returns to opener on close (`state.ui.lastFocus`)

### 4. Button System
- Always use `.button` as base class
- Add exactly one variant class for color
- Wrap related buttons in `.button-row`, `.button-row-center`, or `.button-group`
- Stage buttons go in `.stage-row` for equal-width layout

### 5. Event Delegation
- Prefer event delegation from stable containers over binding to each item
- Example: Lesson list items and pagination use delegation from parent containers
- Bind events once in `bindModalEvents()`, not in render functions

### 6. Class Naming
- Use semantic class names (`.home-card`, `.typing-controls`)
- For modifiers, append descriptively (`.button-primary`, `.meta-chip.complete-chip`)
- Avoid deep nesting; prefer flat structures

---

## Quick Reference: Where Things Live

| What | File |
|------|------|
| All CSS | `styles.css` |
| Screen rendering | `src/ui.js` → `getScreenHtml()` |
| Modal rendering | `src/ui.js` → `getModalHtml()` |
| Screen event binding | `src/main.js` → `bindScreenEvents()` |
| Modal event binding | `src/main.js` → `bindModalEvents()` |
| Lesson picker view model | `src/ui.js` → `deriveLessonPickerViewModel()` |
| State management | `src/main.js` → `state`, `saveState()`, `loadState()` |
| Typing input handling | `src/keyboard.js` |
| Session lifecycle | `src/lessons.js` |
| Progress tracking | `src/progress.js` |

---

## Verification Checklist

Before merging UI changes:

- [ ] Home screen layout is consistent and not cramped
- [ ] Typing screen: target, input, feedback, navigation look aligned
- [ ] Summary screen: buttons and stats align, no overflow
- [ ] Every modal opens and closes correctly
- [ ] Escape closes modals
- [ ] Focus starts in modal, tab cycles within, shift-tab works
- [ ] Closing modal returns focus to opener
- [ ] Lesson picker: search, pagination, stage selection work
- [ ] Progress indicators still correct
- [ ] No console errors during navigation
- [ ] Responsive: works on laptop and tablet screen sizes
