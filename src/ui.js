/**
 * @file ui.js
 * @description Handles all DOM rendering and UI manipulation for the StoryKeys app.
 */
import { config } from './config.js';
import { buildLessonId, getLessonCompletionPercent, getSectionCompletionPercent, isLastLesson } from './progress.js';

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

let lastRenderedState = null;
let lastRenderedData = null;
let hasAutoScrolledToLastLesson = false;

// Helper to read draft info for home screen display
function getDraftInfo() {
    try {
        const raw = localStorage.getItem('storykeys_draft');
        if (!raw) return null;
        const draft = JSON.parse(raw);
        // Expire drafts older than 24 hours
        if (Date.now() - draft.savedAt > 24 * 60 * 60 * 1000) {
            localStorage.removeItem('storykeys_draft');
            return null;
        }
        return draft;
    } catch (e) {
        return null;
    }
}

// Helper to get recent lessons HTML for home screen
function getRecentLessonsHtml(state) {
    if (!state.sessions || state.sessions.length === 0) return '';
    
    // Get last 5 unique lessons
    const seen = new Set();
    const recentLessons = [];
    for (let i = state.sessions.length - 1; i >= 0 && recentLessons.length < 5; i--) {
        const s = state.sessions[i];
        if (!seen.has(s.contentId)) {
            seen.add(s.contentId);
            recentLessons.push({
                id: s.contentId,
                type: s.contentType,
                stage: s.stage,
                accuracy: s.accuracy,
                wpm: s.netWPM,
                ts: s.ts
            });
        }
    }
    
    if (recentLessons.length === 0) return '';
    
    const items = recentLessons.map(lesson => `
        <button class="recent-lesson-btn" data-recent-id="${lesson.id}" data-recent-type="${lesson.type}">
            <span class="recent-title">${lesson.id.split('_').slice(1).join(' ').replace(/_/g, ' ')}</span>
            <span class="recent-stats">${lesson.wpm || '–'} WPM • ${lesson.accuracy}%</span>
        </button>
    `).join('');
    
    return `
        <div class="card home-card recent-lessons-card">
            <h2>Recent Lessons</h2>
            <p>Jump back into a lesson you've tried before.</p>
            <div class="recent-lessons-list">${items}</div>
        </div>`;
}

export function getLessonPickerState() {
    return lessonPickerState;
}

/**

/**
 * Applies visual settings from the state to the document.
 * @param {object} settings - The current application settings.
 * @param {object} progress - The current user progress state.
 */
export function applySettings(settings, progress) {
    const htmlEl = document.documentElement;
    htmlEl.classList.remove('theme-light', 'theme-cream', 'theme-dark');
    htmlEl.classList.add(`theme-${settings.theme}`);
    
    // Handle font family based on setting
    const fontMap = {
        'default': 'var(--font-family-default)',
        'dyslexia': 'var(--font-family-dyslexia)',
        'opendyslexic': 'var(--font-family-opendyslexic)'
    };
    htmlEl.style.setProperty('--font-family', fontMap[settings.font] || fontMap.default);
    
    htmlEl.style.setProperty('--line-height', settings.lineHeight);
    htmlEl.style.setProperty('--letter-spacing', `${settings.letterSpacing / 100}em`);
    
    // Handle reduce motion setting
    htmlEl.classList.toggle('reduce-motion', settings.reduceMotion === true);
    
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
            // Check for draft session
            const draft = getDraftInfo();
            const draftHtml = draft ? `
                <div id="resume-draft-card" class="card home-card resume-card">
                    <h2>📝 Resume Your Session</h2>
                    <p>You have an unfinished ${draft.lessonType}: <strong>${draft.lessonData.title || draft.lessonData.name}</strong></p>
                    <p class="draft-progress">Progress: ${draft.typedText.length} characters typed</p>
                    <div class="button-row">
                        <button id="resume-draft-btn" class="button button-primary">Resume</button>
                        <button id="discard-draft-btn" class="button button-secondary">Discard Draft</button>
                    </div>
                </div>` : '';
            return `
            <div id="home-screen" class="screen active">
                <div class="home-header">
                    <h1>Welcome to StoryKeys</h1>
                    <p>Your calm and friendly space to practice typing.</p>
                </div>
                ${draftHtml}
                <div id="new-story-card" class="card home-card">
                    <h2>Start a New Story</h2>
                    <p>Choose a Key Stage to begin a new passage or jump straight into spelling and phonics practice.</p>
                    <div class="home-stages">
                        <div class="stage-row">
                            <button class="button button-primary" data-stage="KS1">New Key Stage 1 Story</button>
                            <button class="button button-spelling" data-spelling-stage="KS1">KS1 Spelling Practice</button>
                        </div>
                        <div class="stage-row">
                            <button class="button button-primary" data-stage="KS2">New Key Stage 2 Story</button>
                            <button class="button button-spelling" data-spelling-stage="KS2">KS2 Spelling Practice</button>
                        </div>
                        <div class="stage-row">
                            <button class="button button-primary" data-stage="KS3">New Key Stage 3 Story</button>
                            <button class="button button-spelling" data-spelling-stage="KS3">KS3 Spelling Practice</button>
                        </div>
                        <div class="stage-row">
                            <button class="button button-primary" data-stage="KS4">New Key Stage 4 Story</button>
                            <button class="button button-spelling" data-spelling-stage="KS4">KS4 Spelling Practice</button>
                        </div>
                        <button id="phonics-mode-btn" class="button button-phonics">Start Phonics Practice</button>
                    </div>
                </div>
                ${getRecentLessonsHtml(state)}
                <div class="card home-card">
                    <h2>Explore the Library</h2>
                    <p>Browse all content, repeat lessons, or choose word sets and drills.</p>
                    <button id="browse-lessons-btn" class="button button-secondary">Browse All Lessons</button>
                </div>
                <div class="card home-card">
                    <h2>Your Badges</h2>
                    <p>Celebrate your achievements and see which badges you've unlocked.</p>
                    <button id="view-badges-btn" class="button button-secondary">View Earned Badges</button>
                </div>
                <div class="card progress-card">
                    <div class="progress-pet">${currentPet}</div>
                    <div>
                        <h3>Your Progress</h3>
                        <p class="mb-0">You've practiced for <b>${Math.round(state.progress.minutesTotal)} minutes</b> in total. Keep it up!</p>
                    </div>
                </div>
                ${state.progress.consecutiveDays > 0 ? `
                <div class="card streak-card">
                    <div class="streak-icon">🔥</div>
                    <div>
                        <h3>${state.progress.consecutiveDays} Day Streak!</h3>
                        <p class="mb-0">${state.progress.consecutiveDays === 1 ? "You practiced today. Come back tomorrow to keep it going!" : `You've practiced ${state.progress.consecutiveDays} days in a row. Amazing!`}</p>
                    </div>
                </div>` : ''}
            </div>`;
        case 'typing':
            const initialHtml = state.runtime.targetText.split('').map((char, idx) =>
                `<span class="char" data-idx="${idx}">${char}</span>`
            ).join('');

            // Finger zones: left pinky, left ring, left middle, left index, right index, right middle, right ring, right pinky
            const fingerZones = {
                'q': 'lp', 'a': 'lp', 'z': 'lp', '1': 'lp',
                'w': 'lr', 's': 'lr', 'x': 'lr', '2': 'lr',
                'e': 'lm', 'd': 'lm', 'c': 'lm', '3': 'lm',
                'r': 'li', 'f': 'li', 'v': 'li', 't': 'li', 'g': 'li', 'b': 'li', '4': 'li', '5': 'li',
                'y': 'ri', 'h': 'ri', 'n': 'ri', 'u': 'ri', 'j': 'ri', 'm': 'ri', '6': 'ri', '7': 'ri',
                'i': 'rm', 'k': 'rm', ',': 'rm', '8': 'rm',
                'o': 'rr', 'l': 'rr', '.': 'rr', '9': 'rr',
                'p': 'rp', ';': 'rp', '/': 'rp', '0': 'rp',
                ' ': 'thumb'
            };
            const showFingerGuide = state.settings.fingerGuide && state.runtime.flags.keyboardHint;
            const keyboardLayout = [['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'], ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', ';'], ['z', 'x', 'c', 'v', 'b', 'n', 'm', ',', '.']];
            const keyboardHtml = state.runtime.flags.keyboardHint ? `<div id="keyboard-hint" class="${showFingerGuide ? 'finger-guide' : ''}">${keyboardLayout.map(row => `<div class="keyboard-row">${row.map(key => `<div class="key ${showFingerGuide ? 'finger-' + fingerZones[key] : ''}" data-key="${key}">${key}</div>`).join('')}</div>`).join('')}<div class="keyboard-row"><div class="key space ${showFingerGuide ? 'finger-thumb' : ''}" data-key=" ">Space</div></div></div>` : '';
            return `
            <div id="typing-screen" class="screen active">
                <div class="progress-bar-container"><div id="typing-progress-bar" class="progress-bar" style="width: 0%"></div></div>
                <div class="card">
                    <div class="typing-controls">
                        <button id="back-to-home-btn" class="icon-button" title="Back to Home (Esc)"><svg viewBox="0 0 24 24"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"></path></svg></button>
                        <div class="typing-controls__title"><h2>${state.runtime.lesson.data.title || state.runtime.lesson.data.name}</h2></div>
                        <div class="button-group">
                            ${state.runtime.flags.showTimerChip ? `<div id="timer-chip" class="timer-chip">--:--</div>` : ''}
                            <button id="read-aloud-btn" class="button button-secondary read-aloud-btn" title="Read passage aloud">🔊 Read Aloud</button>
                            <label class="toggle-switch">${DATA.COPY.lockstepOn}<input type="checkbox" id="lockstep-toggle" ${state.runtime.flags.lockstep ? 'checked' : ''}><span class="slider"></span></label>
                            <label class="toggle-switch">${DATA.COPY.focusLineOn}<input type="checkbox" id="focusline-toggle" ${state.runtime.flags.focusLine ? 'checked' : ''}><span class="slider"></span></label>
                        </div>
                    </div>
                    <div id="finger-hint" class="finger-hint">
                        <svg viewBox="0 0 160 38" class="finger-diagram">
                            <!-- Left hand (5 fingers in arc) -->
                            <circle cx="11" cy="27" r="7" class="finger" data-finger="lp"/>
                            <circle cx="24" cy="16" r="7" class="finger" data-finger="lr"/>
                            <circle cx="37" cy="11" r="7" class="finger" data-finger="lm"/>
                            <circle cx="50" cy="16" r="7" class="finger" data-finger="li"/>
                            <circle cx="64" cy="27" r="8" class="finger thumb" data-finger="thumb"/>
                            <!-- Right hand (5 fingers in arc) -->
                            <circle cx="96" cy="27" r="8" class="finger thumb" data-finger="thumb"/>
                            <circle cx="110" cy="16" r="7" class="finger" data-finger="ri"/>
                            <circle cx="123" cy="11" r="7" class="finger" data-finger="rm"/>
                            <circle cx="136" cy="16" r="7" class="finger" data-finger="rr"/>
                            <circle cx="149" cy="27" r="7" class="finger" data-finger="rp"/>
                        </svg>
                    </div>
                    <div id="typing-target" class="typing-target ${state.runtime.flags.focusLine ? 'focus-line-active' : ''}">${initialHtml}</div>
                    <textarea id="typing-input" class="typing-input" rows="3" spellcheck="false" autocomplete="off" autocorrect="off" autocapitalize="off"></textarea>
                    ${keyboardHtml}
                </div>
                <div id="pause-overlay" class="pause-overlay hidden">
                    <div class="pause-content">
                        <h2>⏸️ Paused</h2>
                        <p>Press <kbd>Space</kbd> or <kbd>Escape</kbd> to resume</p>
                    </div>
                </div>
            </div>`;
        case 'summary':
            const { accuracy, durationSec, errors, netWPM, grossWPM, hardestKeys, trickyWords, newBadges, isDrill, personalBest } = state.runtime.summaryResults;
            const wpmLabel = DATA.COPY.metricWPM || DATA.COPY.metricNetWPM || 'Words per minute';
            const safeNet = typeof netWPM === 'number' ? netWPM : '—';
            const safeGross = typeof grossWPM === 'number' ? grossWPM : '—';
            const drillBtnHtml = !isDrill && (hardestKeys.length > 0 || trickyWords.length > 0) ? `<button id="start-drill-btn" class="button button-secondary">${DATA.COPY.summaryDrill}</button>` : '';
            const prettyKeyName = (k) => k === ' ' ? 'Space' : k;
            
            // Perfect accuracy celebration
            const isPerfect = accuracy === 100;
            const perfectHtml = isPerfect ? `<div class="perfect-banner">🌟 Perfect Score! 🌟</div>` : '';
            
            // Personal best comparison
            let comparisonHtml = '';
            const isNewBest = personalBest && !isDrill && (netWPM > personalBest.netWPM || accuracy > personalBest.accuracy);
            if (personalBest && !isDrill) {
                const wpmDiff = netWPM - personalBest.netWPM;
                const accDiff = accuracy - personalBest.accuracy;
                const wpmIcon = wpmDiff > 0 ? '🎉' : wpmDiff === 0 ? '➡️' : '⬇️';
                const accIcon = accDiff > 0 ? '🎉' : accDiff === 0 ? '➡️' : '⬇️';
                comparisonHtml = `
                    <div class="personal-best-comparison ${isNewBest ? 'new-best' : ''}">
                        <h3>${isNewBest ? '🏆 New Personal Best!' : 'Compared to your best'}</h3>
                        <div class="comparison-row">
                            <span>WPM: ${personalBest.netWPM}</span>
                            <span class="comparison-arrow">${wpmIcon}</span>
                            <span>${safeNet} ${wpmDiff !== 0 ? `(${wpmDiff > 0 ? '+' : ''}${wpmDiff})` : ''}</span>
                        </div>
                        <div class="comparison-row">
                            <span>Accuracy: ${personalBest.accuracy}%</span>
                            <span class="comparison-arrow">${accIcon}</span>
                            <span>${accuracy}% ${accDiff !== 0 ? `(${accDiff > 0 ? '+' : ''}${accDiff})` : ''}</span>
                        </div>
                    </div>`;
            }
            
            // WPM Sparkline - tiny graph of speed during session
            const wpmSamples = state.runtime.wpmSamples || [];
            const sparklineHtml = wpmSamples.length > 2 ? (() => {
                const maxWpm = Math.max(...wpmSamples, 1);
                const points = wpmSamples.map((wpm, i) => {
                    const x = (i / (wpmSamples.length - 1)) * 100;
                    const y = 30 - (wpm / maxWpm) * 28;
                    return `${x},${y}`;
                }).join(' ');
                return `
                    <div class="sparkline-container">
                        <h3>Speed During Session</h3>
                        <svg class="sparkline" viewBox="0 0 100 32" preserveAspectRatio="none">
                            <polyline fill="none" stroke="var(--color-accent)" stroke-width="2" points="${points}"/>
                        </svg>
                        <div class="sparkline-labels"><span>Start</span><span>End</span></div>
                    </div>`;
            })() : '';
            
            return `
            <div id="summary-screen" class="screen active ${isNewBest || isPerfect ? 'show-confetti' : ''}">
                <div class="card">
                    ${perfectHtml}
                    <div class="text-center"><h1>${isDrill ? 'Drill Complete!' : DATA.COPY.summaryNiceWork}</h1><p>${DATA.COPY.encourageGentle[Math.floor(Math.random() * DATA.COPY.encourageGentle.length)]}</p></div>
                    ${newBadges.map(id => { const badge = DATA.BADGES.find(b => b.id === id); return `<div class="badge-earned"><h3>Badge Earned: ${badge.label}!</h3><p>${badge.desc}</p></div>`; }).join('')}
                    <div class="summary-metrics">
                        <div class="metric-item"><h3>${DATA.COPY.metricAccuracy}</h3><div class="value">${accuracy}%</div></div>
                        <div class="metric-item"><h3>${wpmLabel}</h3><div class="value">${safeNet}</div><p class="subtitle">(${safeGross} gross)</p></div>
                        <div class="metric-item"><h3>${DATA.COPY.metricTime}</h3><div class="value">${durationSec}s</div></div>
                        <div class="metric-item"><h3>${DATA.COPY.metricErrors}</h3><div class="value">${errors}</div></div>
                    </div>
                    ${sparklineHtml}
                    ${comparisonHtml}
                    <div class="summary-feedback">
                        ${hardestKeys.length > 0 ? `<div><h3>${DATA.COPY.summaryHardestKeys}</h3><ul>${hardestKeys.map(k => `<li>'${prettyKeyName(k)}'</li>`).join('')}</ul></div>` : ''}
                        ${trickyWords.length > 0 ? `<div><h3>${DATA.COPY.summaryTrickyWords}</h3><ul>${trickyWords.map(w => `<li>${w}</li>`).join('')}</ul></div>` : ''}
                    </div>
                    <div class="button-row-center mt-xl">
                        ${!isDrill ? `<button id="replay-btn" class="button button-primary">${DATA.COPY.summaryReplay}</button>` : ''}
                        ${drillBtnHtml}
                        <button id="home-btn" class="button button-secondary">${DATA.COPY.summaryHome}</button>
                    </div>
                    <p class="keyboard-hint-text">Press <kbd>Enter</kbd> to try again • <kbd>Esc</kbd> to go home</p>
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
        case 'welcome':
            return `
            <div class="modal" id="welcome-modal" role="dialog" aria-modal="true" aria-labelledby="welcome-title"><div class="modal-content welcome-modal">
                <div class="modal-header"><h2 id="welcome-title" class="modal-title">Welcome to StoryKeys</h2>${closeModalBtn}</div>
                <p class="lead">A calm, dyslexia-friendly space to build confident typing skills.</p>
                <ul class="welcome-list">
                    <li><strong>Pick a lesson</strong> — stories, spelling lists, phonics, or word sets for KS1–KS4.</li>
                    <li><strong>Read aloud</strong> — tap the speaker button to hear the text before you start.</li>
                    <li><strong>Type at your pace</strong> — the timer only starts when you press your first key.</li>
                    <li><strong>Earn badges</strong> — track your progress and celebrate milestones.</li>
                    <li><strong>Make it yours</strong> — switch themes, fonts, and toggle sounds in Settings.</li>
                </ul>
                <p class="welcome-hint">Your progress stays on this computer — no account needed.</p>
                <div class="modal-footer">
                    <button id="welcome-start-btn" class="button button-primary">Let's start</button>
                </div>
            </div></div>`;
        case 'about':
            return `
            <div class="modal" role="dialog" aria-modal="true" aria-labelledby="about-title"><div class="modal-content about-modal">
                <div class="modal-header"><h2 id="about-title" class="modal-title">StoryKeys</h2>${closeModalBtn}</div>
                <div class="info-block">
                    <h3>About StoryKeys</h3>
                    <div class="markdown-block">${renderMarkdownBlock(ABOUT_MARKDOWN)}</div>
                </div>
                <div class="info-block">
                    <h3>License</h3>
                    <pre class="license-text">${escapeHtml(LICENSE_TEXT)}</pre>
                </div>
            </div></div>`;
        case 'help':
            return `
            <div class="modal" role="dialog" aria-modal="true" aria-labelledby="help-title"><div class="modal-content about-modal">
                <div class="modal-header"><h2 id="help-title" class="modal-title">Need a Hand?</h2>${closeModalBtn}</div>
                <div class="info-block">
                    <h3>What is StoryKeys?</h3>
                    <p>StoryKeys is a reading and typing practice tool using short stories to build confidence and rhythm. It keeps the experience calm so learners can focus on accuracy first, then speed.</p>
                </div>
                <div class="info-block">
                    <h3>How to use it</h3>
                    <ul>
                        <li>Choose a story.</li>
                        <li>Type the text you see.</li>
                        <li>Aim for accuracy first, then speed.</li>
                    </ul>
                </div>
                <div class="info-block">
                    <h3>Features that help</h3>
                    <ul>
                        <li><strong>Focus line:</strong> highlights the current line so eyes stay on track.</li>
                        <li><strong>Lock-step / guided mode:</strong> prevents moving ahead until each letter matches.</li>
                        <li><strong>Lesson progress:</strong> completion markers and gentle badges celebrate milestones.</li>
                    </ul>
                </div>
                <div class="info-block">
                    <h3>Typing screen basics</h3>
                    <p>Read the line, then type it. The next letter glows to guide you, and mistakes show in red so they are easy to correct. Toggle the focus line, on-screen keyboard, or timer in Settings if you want extra scaffolding.</p>
                </div>
                <div class="info-block" id="help-data-privacy">
                    <h3>Data & Privacy</h3>
                    <ul>
                        <li>Your progress is stored only in this browser using localStorage.</li>
                        <li>No accounts, no cloud storage, no third-party trackers.</li>
                        <li>You can export or erase local data via Parent Glance.</li>
                    </ul>
                </div>
                <div class="info-block">
                    <h3>Tips in Simple Words</h3>
                    <ul>
                        <li>Take your time. Accuracy comes first.</li>
                        <li>Keep fingers relaxed on the home row keys.</li>
                        <li>Watch for green letters to know you are right.</li>
                        <li>Short breaks help hands and eyes stay fresh.</li>
                    </ul>
                </div>
                <div class="info-block">
                    <h3>Keyboard Shortcuts</h3>
                    <ul class="shortcuts-list">
                        <li><kbd>Enter</kbd> Start lesson / Try again</li>
                        <li><kbd>Escape</kbd> Pause typing / Go home</li>
                        <li><kbd>Space</kbd> Resume when paused</li>
                    </ul>
                </div>
            </div></div>`;
        case 'badges':
            const earnedBadges = state.progress.badges.map(entry => {
                const badge = DATA.BADGES.find(b => b.id === entry.id) || { label: entry.id, desc: 'Badge earned.' };
                const earnedDate = entry.earnedAt ? new Date(entry.earnedAt).toLocaleDateString() : '';
                const dateLine = earnedDate ? `<small>Earned on ${earnedDate}</small>` : '';
                return `<div class="badge-card"><h4>${badge.label}</h4><p>${badge.desc}</p>${dateLine}</div>`;
            });
            const hasBadges = earnedBadges.length > 0;
            return `
            <div class="modal" role="dialog" aria-modal="true" aria-labelledby="badges-title"><div class="modal-content">
                <div class="modal-header"><h2 id="badges-title" class="modal-title">Your Badges</h2>${closeModalBtn}</div>
                ${hasBadges ? `<div class="badge-grid">${earnedBadges.join('')}</div>` : '<p>You have not earned any badges yet. Complete lessons to unlock them!</p>'}
                ${hasBadges ? `<div class="modal-footer"><button id="print-certificate-btn" class="button button-secondary">🎓 Print Certificate</button></div>` : ''}
            </div></div>`;
        case 'lessonPicker':
            // Note: State is set in resetLessonPickerState(), not here (render purity)
            return `
            <div class="modal" role="dialog" aria-modal="true" aria-labelledby="lesson-picker-title"><div class="modal-content lesson-picker-modal">
                <div class="modal-header"><h2 id="lesson-picker-title" class="modal-title">${DATA.COPY.homeChangeLesson}</h2>${closeModalBtn}</div>
                <div class="tabs"><button class="tab-button active" data-type="passage">Passages</button><button class="tab-button" data-type="phonics">Phonics</button><button class="tab-button" data-type="spelling">Spelling Tutor</button><button class="tab-button" data-type="wordset">Word Sets</button></div>
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
            <div class="modal" role="dialog" aria-modal="true" aria-labelledby="settings-title"><div class="modal-content">
                <div class="modal-header"><h2 id="settings-title" class="modal-title">Settings</h2>${closeModalBtn}</div>
                <details class="settings-section" open>
                    <summary>Appearance</summary>
                    <div class="setting-item"><div><b>Theme</b><p>Change the app's colour scheme.</p></div><select id="setting-theme" class="button button-secondary"><option value="cream">Cream</option><option value="light">Light</option><option value="dark">Dark</option></select></div>
                    <div class="setting-item"><div><b>Font</b><p>Choose a clearer font for reading.</p></div><select id="setting-font" class="button button-secondary"><option value="default">Default</option><option value="dyslexia">Clear (Arial)</option><option value="opendyslexic">OpenDyslexic</option></select></div>
                    <div class="setting-item"><div><b>Line Height: <span id="lh-val"></span></b><p>Space between lines of text.</p></div><input type="range" id="setting-line-height" min="1.4" max="2.0" step="0.1"></div>
                    <div class="setting-item"><div><b>Letter Spacing: <span id="ls-val"></span></b><p>Space between letters.</p></div><input type="range" id="setting-letter-spacing" min="0" max="8" step="1"></div>
                    <div class="setting-item"><div><b>Reduce Motion</b><p>Disable animations and effects.</p></div><label class="toggle-switch"><input type="checkbox" id="setting-reduce-motion"><span class="slider"></span></label></div>
                </details>
                <details class="settings-section" open>
                    <summary>Typing Helpers</summary>
                    <div class="setting-item"><div><b>Lockstep Mode</b><p>Must fix mistakes before continuing.</p></div><label class="toggle-switch"><input type="checkbox" id="setting-lockstep"><span class="slider"></span></label></div>
                    <div class="setting-item"><div><b>Focus Line</b><p>Highlight the current line of text.</p></div><label class="toggle-switch"><input type="checkbox" id="setting-focusline"><span class="slider"></span></label></div>
                    <div class="setting-item"><div><b>Keyboard Guide</b><p>Show on-screen keyboard hints.</p></div><label class="toggle-switch"><input type="checkbox" id="setting-keyboard"><span class="slider"></span></label></div>
                    <div class="setting-item"><div><b>Finger Guide</b><p>Show which finger to use.</p></div><label class="toggle-switch"><input type="checkbox" id="setting-finger-guide"><span class="slider"></span></label></div>
                </details>
                <details class="settings-section" open>
                    <summary>Sound &amp; Speech</summary>
                    <div class="setting-item"><div><b>Typing Sounds</b><p>Play soft clicks while typing.</p></div><label class="toggle-switch"><input type="checkbox" id="setting-sound"><span class="slider"></span></label></div>
                    <div class="setting-item"><div><b>Read Aloud Voice</b><p>Voice for passage previews.</p></div><select id="setting-voice-gender" class="button button-secondary"><option value="female">Female</option><option value="male">Male</option></select></div>
                    <div class="setting-item"><div><b>Voice Speed: <span id="vs-val"></span></b><p>How fast text is read aloud.</p></div><input type="range" id="setting-voice-speed" min="0.5" max="1.2" step="0.05"></div>
                </details>
                <details class="settings-section">
                    <summary>General</summary>
                    <div class="setting-item"><div><b>Default Stage</b><p>Stage used for Quick Start.</p></div><select id="setting-default-stage" class="button button-secondary"><option value="KS1">KS1</option><option value="KS2">KS2</option><option value="KS3">KS3</option><option value="KS4">KS4</option></select></div>
                    <div class="setting-item"><div><b>Show Timer</b><p>Display timer during lessons.</p></div><label class="toggle-switch"><input type="checkbox" id="setting-timer-display"><span class="slider"></span></label></div>
                    <div class="setting-item"><div><b>Parent PIN</b><p>Protect Parent Glance access.</p></div><input type="password" id="setting-pin" class="pin-input" maxlength="4" placeholder="4 digits"></div>
                </details>
                <div class="modal-footer">
                    <button id="save-settings-btn" class="button button-primary">Close & Save</button>
                </div>
            </div></div>`;
        case 'parent':
            const weeklySessions = state.sessions.filter(s => (new Date() - new Date(s.ts)) < 7 * 24 * 60 * 60 * 1000);
            const avgAccuracy = weeklySessions.length ? Math.round(weeklySessions.reduce((acc, s) => acc + s.accuracy, 0) / weeklySessions.length) : 'N/A';
            return `
            <div class="modal" role="dialog" aria-modal="true" aria-labelledby="parent-title"><div class="modal-content">
                <div class="modal-header"><h2 id="parent-title" class="modal-title">Parent Glance</h2>${closeModalBtn}</div>
                <h3>This Week</h3><p>Sessions: ${weeklySessions.length} | Avg. Accuracy: ${avgAccuracy}%</p>
                <h3>All Time</h3><p>Total Minutes: ${Math.round(state.progress.minutesTotal)}</p>
                <h3>Recent Sessions</h3>
                <div class="session-list">${state.sessions.slice(-10).reverse().map(s => {
                    const wpmText = typeof s.netWPM === 'number' ? `${s.netWPM} wpm` : '– wpm';
                    return `<p class="session-item">${new Date(s.ts).toLocaleString()}: ${s.accuracy}% acc • ${wpmText}</p>`;
                }).join('') || '<p>No sessions yet.</p>'}</div>
                <div class="button-row mt-lg">
                    <button id="export-btn" class="button button-secondary">Export Data</button>
                    <button id="clear-data-btn" class="button button-danger">Clear All Data</button>
                </div>
            </div></div>`;
        case 'pin': return `
            <div class="modal" role="dialog" aria-modal="true" aria-labelledby="pin-title"><div class="modal-content text-center">
                <h2 id="pin-title" class="modal-title">Enter PIN</h2>
                <input type="password" id="pin-input" class="pin-input pin-input-lg" maxlength="4">
                <div class="modal-footer">
                    <button id="pin-submit-btn" class="button button-primary">Unlock</button>
                </div>
            </div></div>`;
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

function updateStageProgressBadges(state, DATA, type) {
    if (type === 'phonics') return;
    const stageButtons = document.querySelectorAll('.stage-filter .button');
    if (!stageButtons?.length || !state || !DATA) return;

    stageButtons.forEach(btn => {
        const stage = btn.dataset.stage;
        const percent = getSectionCompletionPercent(state, DATA, type, stage);
        let badge = btn.querySelector('.stage-progress');
        if (!badge) {
            badge = document.createElement('span');
            badge.className = 'stage-progress';
            btn.appendChild(badge);
        }
        badge.textContent = `${percent}%`;
        badge.title = `Average completion for ${stage}`;
    });
}

/**
 * Pure function: Derives a view model for the lesson picker.
 * No state mutation, no DOM access.
 * @param {object} lessonPickerState - The current lesson picker state.
 * @param {object} state - The main application state (for progress).
 * @param {object} DATA - The global data object.
 * @returns {object} The derived view model.
 */
export function deriveLessonPickerViewModel(lessonPickerState, state, DATA) {
    const { currentType, currentStage, searchTerm, sortKey, currentPage } = lessonPickerState;
    const poolMap = {
        passage: DATA.PASSAGES,
        phonics: DATA.PHONICS,
        spelling: DATA.SPELLING,
        wordset: DATA.WORDSETS
    };
    const pool = poolMap[currentType] || DATA.PASSAGES;

    // 1. Filter
    const useStageFilter = currentType !== 'phonics';
    let filtered = useStageFilter ? pool.filter(l => !l.stage || l.stage === currentStage) : [...pool];
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
        return (a.title || a.name).localeCompare(b.title || b.name);
    });

    // 3. Paginate
    const totalPages = Math.max(1, Math.ceil(filtered.length / config.LESSONS_PER_PAGE));
    const start = (currentPage - 1) * config.LESSONS_PER_PAGE;
    const end = start + config.LESSONS_PER_PAGE;
    const pageItems = filtered.slice(start, end);

    // 4. Map items to view model with computed properties
    const items = pageItems.map(l => {
        const len = getLessonLength(l);
        const wordCount = l.words ? l.words.length : Math.round(len / 5);
        const lessonId = buildLessonId(currentType, l);
        const completionPercent = getLessonCompletionPercent(state, lessonId);
        const tags = l.tags?.complexity ?? { caps: true, punct: true };

        // Generate preview text (first ~100 chars)
        const rawText = l.text || (l.words ? l.words.slice(0, 15).join(' ') : '');
        const preview = rawText.slice(0, 100) + (rawText.length > 100 ? '…' : '');

        return {
            id: l.id,
            type: currentType,
            lessonId,
            title: l.title || l.name,
            theme: l.theme,
            icon: THEME_ICONS[l.theme] || '📝',
            lenDisplay: `≈ ${len} chars / ${wordCount} words`,
            completionPercent,
            completionLabel: completionPercent === 100 ? 'Completed ✓' : `${completionPercent}% complete`,
            isComplete: completionPercent === 100,
            isLastVisited: isLastLesson(state, lessonId),
            hasCaps: tags.caps,
            hasPunct: tags.punct,
            preview
        };
    });

    return {
        items,
        currentPage,
        totalPages,
        totalFiltered: filtered.length,
        hasNextPage: currentPage < totalPages,
        hasPrevPage: currentPage > 1,
        currentType,
        currentStage,
        lastLessonId: state?.meta?.lastLessonId || null
    };
}

/**
 * Renders the lesson list DOM based on the view model (DOM update only).
 * @param {object} vm - The view model from deriveLessonPickerViewModel.
 */
function renderLessonListDOM(vm) {
    const listEl = document.querySelector('.lesson-list');
    if (!listEl) return;

    if (vm.items.length === 0) {
        listEl.innerHTML = `<p class="no-results">No lessons found. Try adjusting your search or filters.</p>`;
    } else {
        listEl.innerHTML = vm.items.map(item => `
            <div class="lesson-item" data-id="${item.id}" data-type="${item.type}" data-lesson-id="${item.lessonId}" title="${escapeHtml(item.preview)}">
                <div class="lesson-icon">${item.icon}</div>
                <div class="lesson-details">
                    <b>${item.title}</b>
                    <div class="lesson-meta">
                        <span class="meta-chip">${item.theme}</span>
                        <span class="meta-chip">${item.lenDisplay}</span>
                        ${item.hasCaps ? '<span class="meta-chip" title="Includes capital letters">Aa</span>' : ''}
                        ${item.hasPunct ? '<span class="meta-chip" title="Includes punctuation">.,!</span>' : ''}
                        <span class="meta-chip ${item.isComplete ? 'complete-chip' : 'progress-chip'}">${item.completionLabel}</span>
                        ${item.isLastVisited ? '<span class="last-visited">← Last visited</span>' : ''}
                    </div>
                </div>
                <button class="button button-primary lesson-start-btn" data-start="true">Start</button>
            </div>
        `).join('');
    }
    listEl.classList.remove('loading');
}

/**
 * Renders the pagination controls (DOM update only).
 * @param {object} vm - The view model from deriveLessonPickerViewModel.
 */
function renderPaginationDOM(vm) {
    const container = document.querySelector('.pagination-controls');
    if (!container) return;

    if (vm.totalPages <= 1) {
        container.innerHTML = '';
        return;
    }

    // Use data attributes for event delegation in main.js
    container.innerHTML = `
        <button class="button button-secondary" data-action="prev-page" ${!vm.hasPrevPage ? 'disabled' : ''}>Previous</button>
        <span>Page ${vm.currentPage} of ${vm.totalPages}</span>
        <button class="button button-secondary" data-action="next-page" ${!vm.hasNextPage ? 'disabled' : ''}>Next</button>
    `;
}

/**
 * Renders the list of lessons based on the current filters, sorting, and pagination.
 * @param {object} DATA - The global data object.
 * @param {object} state - The main application state.
 */
export function renderLessonList(DATA, state) {
    lastRenderedState = state;
    lastRenderedData = DATA;
    
    // Derive view model (pure)
    const vm = deriveLessonPickerViewModel(lessonPickerState, state, DATA);
    
    // Store totalPages in module state for event handlers
    lessonPickerState._totalPages = vm.totalPages;
    
    // Update DOM
    updateStageProgressBadges(state, DATA, vm.currentType);
    renderLessonListDOM(vm);
    renderPaginationDOM(vm);

    // Auto-scroll to last visited (one-time)
    if (!hasAutoScrolledToLastLesson && vm.lastLessonId) {
        const listEl = document.querySelector('.lesson-list');
        const target = listEl?.querySelector(`[data-lesson-id="${vm.lastLessonId}"]`);
        if (target) {
            target.scrollIntoView({ block: 'center', behavior: 'smooth' });
            hasAutoScrolledToLastLesson = true;
        }
    }
}

/**
 * Handles pagination navigation (called from main.js event delegation).
 * @param {string} action - 'prev-page' or 'next-page'
 */
export function handleLessonPickerPagination(action) {
    if (action === 'prev-page' && lessonPickerState.currentPage > 1) {
        lessonPickerState.currentPage--;
        renderLessonList(lastRenderedData, lastRenderedState);
    } else if (action === 'next-page' && lessonPickerState.currentPage < lessonPickerState._totalPages) {
        lessonPickerState.currentPage++;
        renderLessonList(lastRenderedData, lastRenderedState);
    }
}


/**
 * Public function to update the lesson picker state and trigger a re-render.
 * @param {object} updates - An object containing state updates.
 */
export function updateLessonPicker(updates, state, DATA) {
    Object.assign(lessonPickerState, updates);
    renderLessonList(DATA, state);
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
    hasAutoScrolledToLastLesson = false;
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
/**
 * Generates and opens a printable certificate in a new window.
 * @param {object} state - The main application state.
 * @param {object} DATA - The global data object.
 */
export function printCertificate(state, DATA) {
    const badges = state.progress.badges.map(entry => {
        const badge = DATA.BADGES.find(b => b.id === entry.id) || { label: entry.id };
        return badge.label;
    });
    const totalMinutes = Math.round(state.progress.minutesTotal);
    const dateString = new Date().toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' });
    
    const certificateHtml = `
<!DOCTYPE html>
<html>
<head>
    <title>StoryKeys Certificate</title>
    <style>
        @page { size: landscape; margin: 0.5in; }
        body {
            font-family: Georgia, 'Times New Roman', serif;
            text-align: center;
            padding: 40px;
            background: linear-gradient(135deg, #fef3c7, #fff);
            min-height: 100vh;
            box-sizing: border-box;
        }
        .certificate {
            border: 8px double #b45309;
            padding: 40px;
            background: #fffbeb;
            max-width: 900px;
            margin: 0 auto;
        }
        h1 {
            color: #92400e;
            font-size: 2.5rem;
            margin: 0;
            letter-spacing: 0.1em;
        }
        .subtitle {
            font-size: 1.2rem;
            color: #78350f;
            margin: 10px 0 30px;
        }
        .recipient {
            font-size: 1.8rem;
            font-style: italic;
            color: #1f2937;
            margin: 30px 0;
            border-bottom: 2px solid #d97706;
            padding-bottom: 10px;
            display: inline-block;
            min-width: 300px;
        }
        .achievement-text {
            font-size: 1.1rem;
            color: #374151;
            margin: 20px 0;
        }
        .badges {
            margin: 30px 0;
            display: flex;
            flex-wrap: wrap;
            justify-content: center;
            gap: 10px;
        }
        .badge-chip {
            background: #fef3c7;
            border: 1px solid #f59e0b;
            padding: 5px 15px;
            border-radius: 20px;
            font-size: 0.9rem;
        }
        .stats {
            margin: 20px 0;
            font-size: 1rem;
            color: #6b7280;
        }
        .date {
            margin-top: 40px;
            font-size: 0.95rem;
            color: #9ca3af;
        }
        .logo {
            font-size: 2rem;
            margin-bottom: 10px;
        }
        @media print {
            body { background: white; }
            .certificate { box-shadow: none; }
        }
    </style>
</head>
<body>
    <div class="certificate">
        <div class="logo">📚✨</div>
        <h1>Certificate of Achievement</h1>
        <p class="subtitle">StoryKeys Typing Practice</p>
        <p class="achievement-text">This certificate is awarded to</p>
        <div class="recipient">________________</div>
        <p class="achievement-text">for demonstrating dedication and skill in typing practice,<br>earning ${badges.length} badge${badges.length !== 1 ? 's' : ''} and practicing for ${totalMinutes} minutes.</p>
        <div class="badges">
            ${badges.slice(0, 12).map(b => `<span class="badge-chip">${b}</span>`).join('')}
            ${badges.length > 12 ? `<span class="badge-chip">+${badges.length - 12} more</span>` : ''}
        </div>
        <p class="date">Awarded on ${dateString}</p>
    </div>
    <script>window.onload = () => window.print();</script>
</body>
</html>`;
    
    const printWindow = window.open('', '_blank');
    if (printWindow) {
        printWindow.document.write(certificateHtml);
        printWindow.document.close();
    } else {
        toast('Pop-up blocked. Please allow pop-ups to print the certificate.');
    }
}