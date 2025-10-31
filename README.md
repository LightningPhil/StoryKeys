# StoryKeys Typing Tutor

**A calm, dyslexia-friendly typing app for young learners.**

StoryKeys is a simple, effective, and privacy-focused typing tutor designed to help children improve their typing skills. The application is built as a single-page web app that runs entirely in the browser, meaning no user data is ever sent to a server. All progress is stored locally on the user's machine.

The content is aligned with the UK Key Stages (KS1-KS4), providing age-appropriate word sets, short passages, and phonetic pattern drills.

---

## ✨ Key Features

*   **Dyslexia-Friendly Design:** Uses a clear, readable font and adjustable line/letter spacing to reduce visual stress.
*   **Key Stage Aligned Content:** Lessons are categorized by UK Key Stages 1 through 4, ensuring the vocabulary and complexity are appropriate for the learner.
*   **Multiple Practice Modes:**
    *   **Passages:** Type short, engaging stories.
    *   **Word Sets:** Practice specific vocabulary lists (e.g., statutory spellings, science terms).
    *   **Focus Drills:** Automatically generated drills to practice keys and words the user struggles with.
*   **Privacy First:** 100% client-side. All data is stored in the browser's `localStorage`. No internet connection is required after the initial load.
*   **Progress Tracking & Badges:** Monitors progress over time (minutes typed, words typed) and awards badges for achieving milestones, encouraging consistent practice.
*   **Customisable UI:** Users can switch between light, dark, and cream themes and adjust readability settings.

---

## 💻 Tech Stack

This project is intentionally simple and built with web fundamentals:

*   **HTML5**
*   **CSS3** (with CSS Variables for theming)
*   **Vanilla JavaScript** (ES6 Modules)
*   **JSON** for all lesson and configuration data.

No frameworks, no build tools, no external dependencies. This ensures the project is lightweight, fast, and easy to maintain.

---

## 📂 Project Structure

The project has been refactored into a modular structure to make managing content easy.

```
/StoryKeys/
├── data/
│   ├── KS1/
│   │   ├── passages.json
│   │   ├── patterns.json
│   │   └── wordsets.json
│   ├── KS2/
│   ├── KS3/
│   ├── KS4/
│   ├── badges.json      (Global badge definitions)
│   ├── copy.json        (All UI text and labels)
│   └── keymap.json      (Keyboard layout data)
│
├── src/
│   ├── main.js          (Main app controller)
│   ├── dataLoader.js    (Loads all JSON data)
│   ├── ui.js            (Handles all HTML rendering)
│   ├── lessons.js       (Manages lesson lifecycle)
│   ├── keyboard.js      (Handles typing input and display)
│   ├── stats.js         (Calculates WPM, accuracy, etc.)
│   ├── badges.js        (Handles badge awarding logic)
│   └── utils.js         (Common helper functions)
│
└── index.html           (The main application shell)
```

---

## 🚀 Getting Started

Because the application now loads its data and code from separate files using modern JavaScript modules, you cannot run it by simply opening `index.html` directly from your file explorer. This will cause a browser security error (CORS).

You **must** serve the files using a simple local web server.

### Option 1: Using IIS on Windows (Your Current Setup)

1.  Ensure your `StoryKeys` project folder is set up as an **Application** in IIS, pointing to the project's root directory.
2.  Ensure the Application Pool Identity (e.g., `IIS AppPool\DefaultAppPool`) has **Read** permissions on the project folder.
3.  Ensure `index.html` is set as a **Default Document**.
4.  Access the application at the URL you configured, for example: `http://localhost/StoryKeys/`.

### Option 2: Using VS Code Live Server (Recommended for easy editing)

1.  Install the **Live Server** extension in Visual Studio Code.
2.  Open the `StoryKeys` project folder in VS Code.
3.  Right-click on the root `index.html` file and select "Open with Live Server".
4.  Your browser will open automatically to the correct address.

---

## ✍️ Managing Content

The primary benefit of this new structure is that **you can add or edit lessons without touching any code.**

### How to Add a New Passage

1.  **Locate the correct file.** For example, to add a new Key Stage 2 passage, open `data/KS2/passages.json`.

2.  **Add a new JSON object** to the array. The file is a list of lesson objects `[ { ... }, { ... } ]`. Add a comma after the last existing object and paste your new one.

3.  **Use the following structure:**
    ```json
    {
      "id": "ks2_theme_title_1",     // A unique ID: stage_theme_short-title_version
      "stage": "KS2",                 // Must be KS1, KS2, KS3, or KS4
      "theme": "Silly Stories",       // The category it will appear under
      "title": "The Squirrel's Secret", // The title displayed to the user
      "text": "Barnaby the squirrel had a secret. He didn't actually like nuts. He much preferred a nice cup of tea and a biscuit.",
      "tags": {
        "complexity": {
          "caps": true,             // Does the text include capital letters?
          "punct": true             // Does the text include punctuation?
        }
      },
      "meta": {
        "est_chars": 135              // Optional: an estimate of the character count
      }
    }
    ```

4.  **Save the file.** The new lesson will automatically appear in the "Browse Lessons" modal next time you load the app.

---

## 🗺️ Project Roadmap: Stage 2 PRD Goals

This project has successfully completed Stage 1 (Architectural Modularisation). The next phase of development will focus on enhancing the user experience and preparing the application to handle a much larger library of content.

The following features are planned for **Stage 2**:

*   #### **Enhanced Lesson Browsing**
    *   **Search:** Add a search bar to the "Browse Lessons" modal to instantly filter passages and word sets by title or theme.
    *   **Sorting:** Implement a dropdown to sort lessons by Title, Length, or Theme.
    *   **Pagination:** To handle hundreds of lessons gracefully, the lesson list will be paginated, showing a limited number of items per page with "Next" and "Previous" controls.

*   #### **Smarter "Quick Start" Randomiser**
    *   The "Begin a New Story" button will be updated to prioritize lessons that the user has not completed recently, ensuring greater variety in practice sessions.

*   #### **Performance & Scalability**
    *   **Lazy Loading:** Modify the data loader to only fetch the JSON files for the currently selected Key Stage, improving initial load time.
    *   **In-Memory Indexing:** Build efficient search and sort capabilities that work instantly on the client-side without re-iterating large arrays.

*   #### **UI & UX Refinements**
    *   Improve the metadata display in the lesson list to show both character and approximate word count.
    *   Ensure all current and future themes have consistent, high-quality icons.