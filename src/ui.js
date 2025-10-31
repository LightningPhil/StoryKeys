/**
 * @file ui.js
 * @description Handles all DOM rendering and UI manipulation for the StoryKeys app.
 */

// These constants are UI-specific and belong here.
const PET_LEVELS = ['💠', '🐣', '🐤', '🐔', '🦖', '🐉'];
const THEME_ICONS = { "Animals": "🐾", "Silly Stories": "🤪", "Nature": "🌿", "Core": "📚", "Phonics": "🔤", "Statutory": "📜", "Science snips": "🔬", "Myths": "🦄", "Academic": "🎓", "History": "🏛️", "Geography": "🗺️" };

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
                <div class="card home-card">
                    <h2>Quick Start</h2>
                    <p>Jump right into a random story from your stage to get you typing instantly.</p>
                    <button id="start-random-btn" class="button button-primary" style="font-size: 1.2rem; padding: 1rem 2rem;">Begin a New Story</button>
                </div>
                <div class="card home-card">
                    <h2>Explore the Library</h2>
                    <p>Choose from a collection of passages, word sets, and phonics drills tailored to your learning stage.</p>
                    <button id="browse-lessons-btn" class="button button-secondary">Browse Lessons</button>
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
                            ${state.runtime.flags.timer ? `<div id="timer-chip" class="timer-chip">--:--</div>` : ''}
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
            const { accuracy, durationSec, errors, netWPM, hardestKeys, trickyWords, newBadges, isDrill } = state.runtime.summaryResults;
            const allowWPM = () => {
                if (state.runtime.flags.timer) return true;
                const recent = state.sessions.slice(-3);
                const count95 = recent.filter(s => s.accuracy >= 95).length;
                return count95 >= 2 && accuracy >= 95;
            };
            const showWpm = allowWPM();
            const drillBtnHtml = !isDrill && (hardestKeys.length > 0 || trickyWords.length > 0) ? `<button id="start-drill-btn" class="button button-secondary">${DATA.COPY.summaryDrill}</button>` : '';
            const prettyKeyName = (k) => k === ' ' ? 'Space' : k;
            return `
            <div id="summary-screen" class="screen active">
                <div class="card">
                    <div style="text-align: center;"><h1>${isDrill ? 'Drill Complete!' : DATA.COPY.summaryNiceWork}</h1><p>${DATA.COPY.encourageGentle[Math.floor(Math.random() * DATA.COPY.encourageGentle.length)]}</p></div>
                    ${newBadges.map(id => { const badge = DATA.BADGES.find(b => b.id === id); return `<div class="badge-earned"><h3>Badge Earned: ${badge.label}!</h3><p>${badge.desc}</p></div>`; }).join('')}
                    <div class="summary-metrics">
                        <div class="metric-item"><h3>${DATA.COPY.metricAccuracy}</h3><div class="value">${accuracy}%</div></div>
                        ${showWpm ? `<div class="metric-item"><h3>${DATA.COPY.metricNetWPM}</h3><div class="value">${netWPM}</div></div>` : ''}
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
        case 'lessonPicker': return `
            <div class="modal"><div class="modal-content">
                <div class="modal-header"><h2>${DATA.COPY.homeChangeLesson}</h2>${closeModalBtn}</div>
                <div class="tabs"><button class="tab-button active" data-type="passage">Passages</button><button class="tab-button" data-type="wordset">Word Sets</button></div>
                <div class="filter-group">
                    <label>Stage:</label>
                    <div class="stage-filter button-group">
                        <button class="button button-secondary" data-stage="KS1">KS1</button>
                        <button class="button button-secondary" data-stage="KS2">KS2</button>
                        <button class="button button-secondary" data-stage="KS3">KS3</button>
                        <button class="button button-secondary" data-stage="KS4">KS4</button>
                    </div>
                </div>
                <div class="lesson-list"></div>
                <div style="margin-top: 1.5rem; border-top: 1px solid var(--color-border); padding-top: 1rem;">
                    <label class="toggle-switch"><input type="checkbox" id="option-timer"><span class="slider"></span> Start with timer</label>
                </div>
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
                <h3>Recent Sessions</h3><div style="max-height: 200px; overflow-y: auto; border: 1px solid var(--color-border); padding: 0.5rem; border-radius: var(--border-radius);">${state.sessions.slice(-10).reverse().map(s => `<p style="font-size: 0.9rem; margin-bottom: 0.5rem;">${new Date(s.ts).toLocaleString()}: ${s.accuracy}% acc</p>`).join('') || '<p>No sessions yet.</p>'}</div>
                <div class="button-group" style="margin-top: 1.5rem;"><button id="export-btn" class="button button-secondary">Export Data</button><button id="clear-data-btn" class="button" style="background-color: #c12121; color: white;">Clear All Data</button></div>
            </div></div>`;
        case 'pin': return `<div class="modal"><div class="modal-content" style="text-align: center;"><h2>Enter PIN</h2><input type="password" id="pin-input" maxlength="4" style="text-align: center; font-size: 2rem; width:100px; margin-bottom:1rem;"><br><button id="pin-submit-btn" class="button button-primary">Unlock</button></div></div>`;
    }
    return '';
}


/**
 * Renders a list of lessons into the lesson picker modal.
 * @param {object} state - The current application state.
 * @param {object} DATA - The global data object.
 */
export function renderLessonList(state, DATA) {
    const modalContainer = document.getElementById('modal-container');
    const stageFilter = modalContainer.querySelector('.stage-filter');
    const type = modalContainer.querySelector('.tab-button.active').dataset.type;
    const stage = stageFilter.querySelector('.button.active').dataset.stage;
    
    const pool = type === 'passage' ? DATA.PASSAGES : DATA.WORDSETS;
    const filtered = pool.filter(l => l.stage === stage);

    modalContainer.querySelector('.lesson-list').innerHTML = filtered.map(l => {
        const len = l.words ? l.words.length + ' words' : (l.meta?.est_chars ? `${l.meta.est_chars} chars` : (l.text ? `${l.text.length} chars` : ''));
        return `<div class="lesson-item" data-id="${l.id}" data-type="${type}">
            <div class="lesson-icon">${THEME_ICONS[l.theme] || '📝'}</div>
            <div class="lesson-details">
                <b>${l.title || l.name}</b>
                <div class="lesson-meta"><span class="meta-chip">${l.stage}</span><span class="meta-chip">${len}</span></div>
            </div>
        </div>`;
    }).join('');
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