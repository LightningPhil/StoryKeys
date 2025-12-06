/**
 * @file ui.js
 * @description Handles all DOM rendering and UI manipulation for the StoryKeys app.
 */
import { config } from './config.js';

// These constants are UI-specific and belong here.
const PET_LEVELS = ['💠', '🐣', '🐤', '🐔', '🦖', '🐉'];
const THEME_ICONS = { "Animals": "🐾", "Silly Stories": "🤪", "Nature": "🌿", "Core": "📚", "Phonics": "🔤", "Statutory": "📜", "Science snips": "🔬", "Myths": "🦄", "Academic": "🎓", "History": "🏛️", "Geography": "🗺️" };
const ABOUT_MARKDOWN = `**StoryKeys** is a calm typing companion for learners who benefit from gentle practice. It pairs curated stories with mindful drills so building muscle memory feels encouraging.

This project is designed to respect privacy, celebrate small wins, and make it easy for teachers, parents, and independent learners to explore accessible typing journeys.`;
const LICENSE_TEXT = `MIT License

Copyright (c) 2025 Philip Leichauer

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`;

function escapeHtml(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function renderMarkdownBlock(md) {
    const escaped = escapeHtml(md);
    const formatted = escaped
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/`(.+?)`/g, '<code>$1</code>');
    return formatted
        .split(/\n{2,}/)
        .map(paragraph => `<p>${paragraph.replace(/\n/g, "<br>")}</p>`)
        .join('');
}

// State specific to the lesson picker modal
let lessonPickerState = {
    searchTerm: '',
    sortKey: config.DEFAULT_SORT_KEY,
    currentPage: 1,
    currentType: 'passage',
    currentStage: 'KS2'
};

/**
 * Applies visual settings from the state to the document.
 * @param {object} settings - The current application settings.
 * @param {object} progress - The current user progress state.
 */
export function applySettings(settings, progress) {
    const htmlEl = document.documentElement;
    htmlEl.classList.remove('theme-light', 'theme-cream', 'theme-dark');
    htmlEl.classList.add(`theme-${settings.theme}`);
    htmlEl.style.setProperty('--font-family', settings.font === 'dyslexia' ? 'var(--font-family-dyslexia)' : 'var(--font-family-default)');
    htmlEl.style.setProperty('--line-height', settings.lineHeight);
    htmlEl.style.setProperty('--letter-spacing', `${settings.letterSpacing / 100}em`);
    
    const petIndex = Math.min(PET_LEVELS.length - 1, Math.floor(progress.minutesTotal / 30));
    document.getElementById('progress-pet').textContent = PET_LEVELS[petIndex];
}

/**
 * Generates the HTML content for a specific screen.
 * @param {string} screenName - The name of the screen to render.
 * @param {object} state - The current application state.
 * @param {object} DATA - The global data object.
 * @returns {string} The HTML string for the screen.
 */
export function getScreenHtml(screenName, state, DATA) {
     switch (screenName) {
        case 'home':
            const petIndex = Math.min(PET_LEVELS.length - 1, Math.floor(state.progress.minutesTotal / 30));
            const currentPet = PET_LEVELS[petIndex];
            return `
            <div id="home-screen" class="screen active">
                <div class="home-header">
                    <h1>Welcome to StoryKeys</h1>
                    <p>Your calm and friendly space to practice typing.</p>
                </div>
                <div id="new-story-card" class="card home-card">
                    <h2>Start a New Story</h2>
                    <p>Choose a Key Stage to begin a passage you haven't typed before, or jump straight into phonics practice.</p>
                    <div class="button-group" style="flex-direction: column; align-items: stretch; gap: 0.75rem; margin-top: 1.5rem; max-width: 300px; margin-left: auto; margin-right: auto;">
                        <button class="button button-primary" data-stage="KS1">New Key Stage 1 Story</button>
                        <button class="button button-primary" data-stage="KS2">New Key Stage 2 Story</button>
                        <button class="button button-primary" data-stage="KS3">New Key Stage 3 Story</button>
                        <button class="button button-primary" data-stage="KS4">New Key Stage 4 Story</button>
                        <button id="phonics-mode-btn" class="button button-secondary">Start Phonics Practice</button>
                    </div>
                </div>
                <div class="card home-card">
                    <h2>Explore the Library</h2>
                    <p>Browse all content, repeat lessons, or choose word sets and drills.</p>
                    <button id="browse-lessons-btn" class="button button-secondary">Browse All Lessons</button>
                </div>
                <div class="card progress-card">
                    <div class="progress-pet">${currentPet}</div>
                    <div>
                        <h3>Your Progress</h3>
                        <p style="margin: 0;">You've practiced for <b>${Math.round(state.progress.minutesTotal)} minutes</b> in total. Keep it up!</p>
                    </div>
                </div>
            </div>`;
        case 'typing':
            const initialHtml = state.runtime.targetText.split('').map((char, idx) =>
                `<span class="char" data-idx="${idx}">${char}</span>`
            ).join('');

            const keyboardLayout = [['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'], ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', ';'], ['z', 'x', 'c', 'v', 'b', 'n', 'm', ',', '.']];
            const keyboardHtml = state.runtime.flags.keyboardHint ? `<div id="keyboard-hint">${keyboardLayout.map(row => `<div class="keyboard-row">${row.map(key => `<div class="key" data-key="${key}">${key}</div>`).join('')}</div>`).join('')}<div class="keyboard-row"><div class="key space" data-key=" ">Space</div></div></div>` : '';
            return `
            <div id="typing-screen" class="screen active">
                <div class="card">
                    <div class="typing-controls">
                        <button id="back-to-home-btn" class="icon-button" title="Back to Home"><svg viewBox="0 0 24 24"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"></path></svg></button>
                        <div style="text-align: center; flex-grow: 1;"><h2>${state.runtime.lesson.data.title || state.runtime.lesson.data.name}</h2></div>
                        <div class="button-group">
                            ${state.runtime.flags.showTimerChip ? `<div id="timer-chip" class="timer-chip">--:--</div>` : ''}
                            <label class="toggle-switch">${DATA.COPY.lockstepOn}<input type="checkbox" id="lockstep-toggle" ${state.runtime.flags.lockstep ? 'checked' : ''}><span class="slider"></span></label>
                            <label class="toggle-switch">${DATA.COPY.focusLineOn}<input type="checkbox" id="focusline-toggle" ${state.runtime.flags.focusLine ? 'checked' : ''}><span class="slider"></span></label>
                        </div>
                    </div>
                    <p>${DATA.COPY.typingHeaderReady} <span id="next-key-bubble" class="next-key-bubble"></span></p>
                    <div id="typing-target" class="typing-target ${state.runtime.flags.focusLine ? 'focus-line-active' : ''}">${initialHtml}</div>
                    <textarea id="typing-input" class="typing-input" rows="3" spellcheck="false" autocomplete="off" autocorrect="off" autocapitalize="off"></textarea>
                    ${keyboardHtml}
                </div>
            </div>`;
        case 'summary':
            const { accuracy, durationSec, errors, netWPM, grossWPM, hardestKeys, trickyWords, newBadges, isDrill } = state.runtime.summaryResults;
            const wpmLabel = DATA.COPY.metricWPM || DATA.COPY.metricNetWPM || 'Words per minute';
            const safeNet = typeof netWPM === 'number' ? netWPM : '—';
            const safeGross = typeof grossWPM === 'number' ? grossWPM : '—';
            const drillBtnHtml = !isDrill && (hardestKeys.length > 0 || trickyWords.length > 0) ? `<button id="start-drill-btn" class="button button-secondary">${DATA.COPY.summaryDrill}</button>` : '';
            const prettyKeyName = (k) => k === ' ' ? 'Space' : k;
            return `
            <div id="summary-screen" class="screen active">
                <div class="card">
                    <div style="text-align: center;"><h1>${isDrill ? 'Drill Complete!' : DATA.COPY.summaryNiceWork}</h1><p>${DATA.COPY.encourageGentle[Math.floor(Math.random() * DATA.COPY.encourageGentle.length)]}</p></div>
                    ${newBadges.map(id => { const badge = DATA.BADGES.find(b => b.id === id); return `<div class="badge-earned"><h3>Badge Earned: ${badge.label}!</h3><p>${badge.desc}</p></div>`; }).join('')}
                    <div class="summary-metrics">
                        <div class="metric-item"><h3>${DATA.COPY.metricAccuracy}</h3><div class="value">${accuracy}%</div></div>
                        <div class="metric-item"><h3>${wpmLabel}</h3><div class="value">${safeNet}</div><p style="margin-top:0.5rem; font-size:0.85rem; opacity:0.7;">(${safeGross} gross)</p></div>
                        <div class="metric-item"><h3>${DATA.COPY.metricTime}</h3><div class="value">${durationSec}s</div></div>
                        <div class="metric-item"><h3>${DATA.COPY.metricErrors}</h3><div class="value">${errors}</div></div>
                    </div>
                    <div class="summary-feedback" style="display: flex; gap: 2rem; flex-wrap: wrap; justify-content: center;">
                        ${hardestKeys.length > 0 ? `<div><h3>${DATA.COPY.summaryHardestKeys}</h3><ul>${hardestKeys.map(k => `<li>'${prettyKeyName(k)}'</li>`).join('')}</ul></div>` : ''}
                        ${trickyWords.length > 0 ? `<div><h3>${DATA.COPY.summaryTrickyWords}</h3><ul>${trickyWords.map(w => `<li>${w}</li>`).join('')}</ul></div>` : ''}
                    </div>
                    <div class="button-group" style="margin-top: 2rem; justify-content: center;">
                        ${!isDrill ? `<button id="replay-btn" class="button button-primary">${DATA.COPY.summaryReplay}</button>` : ''}
                        ${drillBtnHtml}
                        <button id="home-btn" class="button button-secondary">${DATA.COPY.summaryHome}</button>
                    </div>
                </div>
            </div>`;
        default: return `<h1>Error</h1>`;
    }
}

/**
 * Generates the HTML content for a specific modal.
 * @param {string} modalName - The name of the modal to render.
 * @param {object} state - The current application state.
 * @param {object} DATA - The global data object.
 * @returns {string} The HTML string for the modal.
 */
export function getModalHtml(modalName, state, DATA) {
    const closeModalBtn = `<button id="close-modal-btn" class="icon-button" title="Close"><svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"></path></svg></button>`;
    switch (modalName) {
        case 'about':
            return `
            <div class="modal"><div class="modal-content about-modal">
                <div class="modal-header"><h2>StoryKeys</h2>${closeModalBtn}</div>
                <div class="info-block">
                    <h3>About StoryKeys</h3>
                    <div class="markdown-block">${renderMarkdownBlock(ABOUT_MARKDOWN)}</div>
                </div>
                <div class="info-block">
                    <h3>License</h3>
                    <pre class="license-text">${escapeHtml(LICENSE_TEXT)}</pre>
                </div>
            </div></div>`;
        case 'lessonPicker':
            lessonPickerState.currentStage = state.settings.defaultStage;
            return `
            <div class="modal"><div class="modal-content">
                <div class="modal-header"><h2>${DATA.COPY.homeChangeLesson}</h2>${closeModalBtn}</div>
                <div class="tabs"><button class="tab-button active" data-type="passage">Passages</button><button class="tab-button" data-type="phonics">Phonics</button><button class="tab-button" data-type="wordset">Word Sets</button></div>
                <div class="filter-group">
                    <label>Stage:</label>
                    <div class="stage-filter button-group">
                        <button class="button button-secondary" data-stage="KS1">KS1</button>
                        <button class="button button-secondary" data-stage="KS2">KS2</button>
                        <button class="button button-secondary" data-stage="KS3">KS3</button>
                        <button class="button button-secondary" data-stage="KS4">KS4</button>
                    </div>
                </div>
                <div class="search-sort-container">
                    <input type="search" id="search-input" class="search-input" placeholder="Search by title or theme...">
                    <select id="sort-select" class="sort-select">
                        <option value="title">Sort by Title</option>
                        <option value="length">Sort by Length</option>
                        <option value="theme">Sort by Theme</option>
                    </select>
                </div>
                <div class="lesson-list"></div>
                <div class="pagination-controls"></div>
            </div></div>`;
        case 'settings': return `
            <div class="modal"><div class="modal-content">
                <div class="modal-header"><h2>Settings</h2>${closeModalBtn}</div>
                <details class="settings-section" open>
                    <summary>Readability</summary>
                    <div class="setting-item"><div><b>Theme</b><p>Change the app's colour scheme.</p></div><select id="setting-theme" class="button button-secondary"><option value="cream">Cream</option><option value="light">Light</option><option value="dark">Dark</option></select></div>
                    <div class="setting-item"><div><b>Font</b><p>Choose a standard or clearer font.</p></div><select id="setting-font" class="button button-secondary"><option value="default">Default</option><option value="dyslexia">Clear</option></select></div>
                    <div class="setting-item"><div><b>Line Height: <span id="lh-val"></span></b><p>Increase space between lines.</p></div><input type="range" id="setting-line-height" min="1.4" max="2.0" step="0.1"></div>
                    <div class="setting-item"><div><b>Letter Spacing: <span id="ls-val"></span></b><p>Increase space between letters.</p></div><input type="range" id="setting-letter-spacing" min="0" max="8" step="1"></div>
                </details>
                <details class="settings-section" open>
                    <summary>Behaviour</summary>
                    <div class="setting-item"><div><b>Lockstep Default</b><p>Prevent errors before they are typed.</p></div><label class="toggle-switch"><input type="checkbox" id="setting-lockstep"><span class="slider"></span></label></div>
                    <div class="setting-item"><div><b>Focus Line Default</b><p>Highlight the current line of text.</p></div><label class="toggle-switch"><input type="checkbox" id="setting-focusline"><span class="slider"></span></label></div>
                    <div class="setting-item"><div><b>Keyboard Hint Default</b><p>Show an on-screen keyboard guide.</p></div><label class="toggle-switch"><input type="checkbox" id="setting-keyboard"><span class="slider"></span></label></div>
                    <div class="setting-item"><div><b>Timer Display</b><p>Show a timer chip during typing sessions.</p></div><label class="toggle-switch"><input type="checkbox" id="setting-timer-display"><span class="slider"></span></label></div>
                    <div class="setting-item"><div><b>Default Stage</b><p>The stage used for 'Quick Start'.</p></div><select id="setting-default-stage" class="button button-secondary"><option value="KS1">KS1</option><option value="KS2">KS2</option><option value="KS3">KS3</option><option value="KS4">KS4</option></select></div>
                </details>
                <details class="settings-section">
                    <summary>Privacy</summary>
                     <div class="setting-item"><div><b>Set Parent PIN</b><p>Set a 4-digit PIN to protect Parent Glance.</p></div><input type="password" id="setting-pin" maxlength="4" placeholder="4 digits" style="width:100px; text-align:center;"></div>
                </details>
                <div style="margin-top:2rem; text-align:center;"><button id="save-settings-btn" class="button button-primary">Close & Save</button></div>
            </div></div>`;
        case 'parent':
            const weeklySessions = state.sessions.filter(s => (new Date() - new Date(s.ts)) < 7 * 24 * 60 * 60 * 1000);
            const avgAccuracy = weeklySessions.length ? Math.round(weeklySessions.reduce((acc, s) => acc + s.accuracy, 0) / weeklySessions.length) : 'N/A';
            return `
            <div class="modal"><div class="modal-content">
                <div class="modal-header"><h2>Parent Glance</h2>${closeModalBtn}</div>
                <h3>This Week</h3><p>Sessions: ${weeklySessions.length} | Avg. Accuracy: ${avgAccuracy}%</p>
                <h3>All Time</h3><p>Total Minutes: ${Math.round(state.progress.minutesTotal)}</p>
                <h3>Recent Sessions</h3><div style="max-height: 200px; overflow-y: auto; border: 1px solid var(--color-border); padding: 0.5rem; border-radius: var(--border-radius);">${state.sessions.slice(-10).reverse().map(s => {
                    const wpmText = typeof s.netWPM === 'number' ? `${s.netWPM} wpm` : '– wpm';
                    return `<p style="font-size: 0.9rem; margin-bottom: 0.5rem;">${new Date(s.ts).toLocaleString()}: ${s.accuracy}% acc • ${wpmText}</p>`;
                }).join('') || '<p>No sessions yet.</p>'}</div>
                <div class="button-group" style="margin-top: 1.5rem;"><button id="export-btn" class="button button-secondary">Export Data</button><button id="clear-data-btn" class="button" style="background-color: #c12121; color: white;">Clear All Data</button></div>
            </div></div>`;
        case 'pin': return `<div class="modal"><div class="modal-content" style="text-align: center;"><h2>Enter PIN</h2><input type="password" id="pin-input" maxlength="4" style="text-align: center; font-size: 2rem; width:100px; margin-bottom:1rem;"><br><button id="pin-submit-btn" class="button button-primary">Unlock</button></div></div>`;
    }
    return '';
}

/**
 * Calculates length for sorting.
 * @param {object} lesson - The lesson object.
 * @returns {number} The length of the lesson content.
 */
function getLessonLength(lesson) {
    if (lesson.meta?.est_chars) return lesson.meta.est_chars;
    if (lesson.text) return lesson.text.length;
    if (lesson.words) return lesson.words.join(' ').length;
    return 0;
}

/**
 * Renders the list of lessons based on the current filters, sorting, and pagination.
 * @param {object} DATA - The global data object.
 */
export function renderLessonList(DATA) {
    const { currentType, currentStage, searchTerm, sortKey, currentPage } = lessonPickerState;
    const poolMap = {
        passage: DATA.PASSAGES,
        phonics: DATA.PHONICS,
        wordset: DATA.WORDSETS
    };
    const pool = poolMap[currentType] || DATA.PASSAGES;

    // 1. Filter
    let filtered = currentType === 'phonics' ? [...pool] : pool.filter(l => l.stage === currentStage);
    if (searchTerm) {
        const term = searchTerm.toLowerCase();
        filtered = filtered.filter(l =>
            (l.title || l.name).toLowerCase().includes(term) ||
            l.theme.toLowerCase().includes(term)
        );
    }

    // 2. Sort
    filtered.sort((a, b) => {
        if (sortKey === 'length') {
            return getLessonLength(a) - getLessonLength(b);
        }
        if (sortKey === 'theme') {
            return (a.theme || '').localeCompare(b.theme || '');
        }
        // Default sort by title
        return (a.title || a.name).localeCompare(b.title || b.name);
    });

    // 3. Paginate
    const totalPages = Math.ceil(filtered.length / config.LESSONS_PER_PAGE);
    const start = (currentPage - 1) * config.LESSONS_PER_PAGE;
    const end = start + config.LESSONS_PER_PAGE;
    const pageItems = filtered.slice(start, end);

    // 4. Render
    const listEl = document.querySelector('.lesson-list');
    if (pageItems.length === 0) {
        listEl.innerHTML = `<p class="no-results">No lessons found. Try adjusting your search or filters.</p>`;
    } else {
        listEl.innerHTML = pageItems.map(l => {
            const len = getLessonLength(l);
            const wordCount = l.words ? l.words.length : Math.round(len / 5);
            const lenDisplay = `≈ ${len} chars / ${wordCount} words`;

            // Default to true if complexity tags are missing
            const tags = l.tags?.complexity ?? { caps: true, punct: true };

            return `<div class="lesson-item" data-id="${l.id}" data-type="${currentType}">
                <div class="lesson-icon">${THEME_ICONS[l.theme] || '📝'}</div>
                <div class="lesson-details">
                    <b>${l.title || l.name}</b>
                    <div class="lesson-meta">
                        <span class="meta-chip">${l.theme}</span>
                        <span class="meta-chip">${lenDisplay}</span>
                        ${tags.caps ? '<span class="meta-chip" title="Includes capital letters">Aa</span>' : ''}
                        ${tags.punct ? '<span class="meta-chip" title="Includes punctuation">.,!</span>' : ''}
                    </div>
                </div>
            </div>`;
        }).join('');
    }

    renderPaginationControls(totalPages);
    listEl.classList.remove('loading');
}


/**
 * Renders the pagination controls for the lesson list.
 * @param {number} totalPages - The total number of pages.
 */
function renderPaginationControls(totalPages) {
    const { currentPage } = lessonPickerState;
    const container = document.querySelector('.pagination-controls');
    
    if (totalPages <= 1) {
        container.innerHTML = '';
        return;
    }

    container.innerHTML = `
        <button id="prev-page-btn" class="button button-secondary" ${currentPage === 1 ? 'disabled' : ''}>Previous</button>
        <span>Page ${currentPage} of ${totalPages}</span>
        <button id="next-page-btn" class="button button-secondary" ${currentPage === totalPages ? 'disabled' : ''}>Next</button>
    `;

    document.getElementById('prev-page-btn')?.addEventListener('click', () => {
        if (lessonPickerState.currentPage > 1) {
            lessonPickerState.currentPage--;
            renderLessonList({ PASSAGES: [], WORDSETS: [], ...window.StoryKeys.DATA }); // Re-render
        }
    });

    document.getElementById('next-page-btn')?.addEventListener('click', () => {
        if (lessonPickerState.currentPage < totalPages) {
            lessonPickerState.currentPage++;
            renderLessonList({ PASSAGES: [], WORDSETS: [], ...window.StoryKeys.DATA }); // Re-render
        }
    });
}


/**
 * Public function to update the lesson picker state and trigger a re-render.
 * @param {object} updates - An object containing state updates.
 */
export function updateLessonPicker(updates, DATA) {
    Object.assign(lessonPickerState, updates);
    renderLessonList(DATA);
}


/**
 * Resets the lesson picker state to its defaults.
 * @param {string} defaultStage - The default stage from settings.
 */
export function resetLessonPickerState(defaultStage) {
    lessonPickerState = {
        searchTerm: '',
        sortKey: config.DEFAULT_SORT_KEY,
        currentPage: 1,
        currentType: 'passage',
        currentStage: defaultStage
    };
}


/**
 * Triggers a confetti animation, typically for earning a badge.
 */
export function triggerConfetti() {
    const container = document.querySelector('.badge-earned');
    if (!container) return;
    for (let i = 0; i < 30; i++) {
        const confetti = document.createElement('div');
        confetti.className = 'confetti';
        confetti.style.left = `${Math.random() * 100}%`;
        confetti.style.animationDelay = `${Math.random() * 2}s`;
        confetti.style.backgroundColor = ['#3b82f6', '#16a34a', '#f59e0b', '#ef4444'][Math.floor(Math.random() * 4)];
        container.appendChild(confetti);
    }
}

/**
 * Displays a short-lived notification message.
 * @param {string} msg - The message to display.
 */
export function toast(msg) {
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2500);
}