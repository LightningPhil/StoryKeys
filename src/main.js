/**
 * @file main.js
 * @description Main application controller for the StoryKeys typing tutor. (Version 8.0 - Stage 2)
 * This file initializes the app, manages state, and wires up event listeners,
 * delegating logic to imported modules.
 */

// --- MODULE IMPORTS ---
import { config } from './config.js';
import { DATA, loadInitialData, loadStageData } from './dataLoader.js';
import { applySettings, getScreenHtml, getModalHtml, updateLessonPicker, resetLessonPickerState, triggerConfetti, toast, getLessonPickerState, handleLessonPickerPagination, printCertificate } from './ui.js';
import { startSession, endSession, startFocusDrill } from './lessons.js';
import { sha256Hex, debounce } from './utils.js';
import { handleTypingInput, calculateVisualLines } from './keyboard.js';

'use strict';
const APP_VERSION = "8.0.0";
const SCHEMA_VERSION = 1;
const CURRENT_WELCOME_VERSION = 1;
const DEFAULT_META = { hasSeenWelcome: false, welcomeVersion: CURRENT_WELCOME_VERSION, lastLessonId: null };
const DRAFT_KEY = 'storykeys_draft';

// --- Draft Session Management ---
function saveDraft(lessonId, lessonType, typedText, lessonData) {
    try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify({
            lessonId,
            lessonType,
            typedText,
            lessonData,
            savedAt: Date.now()
        }));
    } catch (e) {
        console.warn('Unable to save draft:', e);
    }
}

function loadDraft() {
    try {
        const raw = localStorage.getItem(DRAFT_KEY);
        if (!raw) return null;
        const draft = JSON.parse(raw);
        // Expire drafts older than 24 hours
        if (Date.now() - draft.savedAt > 24 * 60 * 60 * 1000) {
            clearDraft();
            return null;
        }
        return draft;
    } catch (e) {
        return null;
    }
}

function clearDraft() {
    localStorage.removeItem(DRAFT_KEY);
}

// Debounced draft saver (saves at most once every 2 seconds)
const debouncedSaveDraft = debounce((state, typedText) => {
    const lessonId = state.runtime?.lesson?.data?.id;
    const lessonType = state.runtime?.lesson?.type;
    if (lessonId && typedText.length > 0) {
        saveDraft(lessonId, lessonType, typedText, state.runtime.lesson.data);
    }
}, 2000);

// --- 1. STATE MANAGEMENT ---
let state = {
    settings: { font: 'default', lineHeight: 1.7, letterSpacing: 2, theme: 'cream', lockstepDefault: true, focusLineDefault: false, keyboardHintDefault: false, showTimerDisplay: true, defaultStage: 'KS2', pin: null },
    progress: { minutesTotal: 0, wordsTotal: 0, badges: [], themesCompleted: {}, stagesCompleted: {}, lastPlayed: null, consecutiveDays: 0, completedPassages: [], completedSpellings: [], completedPhonics: [] },
    sessions: [],
    meta: { ...DEFAULT_META },
    ui: { currentScreen: 'home', modal: null, lastFocus: null },
    runtime: {},
};

function saveState() {
    try {
        localStorage.setItem('storykeys_state', JSON.stringify({ ...state, _v: SCHEMA_VERSION }));
    } catch (e) {
        console.warn('Unable to save state to localStorage:', e);
    }
}

function loadState() {
    try {
        const raw = localStorage.getItem('storykeys_state');
        if (!raw) return;
        const parsed = JSON.parse(raw);
        state.settings = { ...state.settings, ...parsed.settings };
        state.progress = {
            ...state.progress,
            ...parsed.progress,
            completedPassages: parsed.progress?.completedPassages || [],
            completedSpellings: parsed.progress?.completedSpellings || [],
            completedPhonics: parsed.progress?.completedPhonics || [],
        };
        state.sessions = parsed.sessions || [];
        state.meta = { ...DEFAULT_META, ...(parsed.meta || {}) };
    } catch (e) {
        console.error("Failed to parse state from localStorage:", e);
    }
}

function markWelcomeSeen() {
    state.meta.hasSeenWelcome = true;
    state.meta.welcomeVersion = CURRENT_WELCOME_VERSION;
    saveState();
}

function shouldShowWelcome() {
    return !state.meta.hasSeenWelcome || state.meta.welcomeVersion !== CURRENT_WELCOME_VERSION;
}

// --- 2. DOM REFERENCES ---
const mainContent = document.getElementById('main-content');
const modalContainer = document.getElementById('modal-container');

function pickFreshLesson(pool, type) {
    const completedIds = new Set(
        type === 'spelling'
            ? state.progress.completedSpellings || []
            : type === 'phonics'
                ? state.progress.completedPhonics || []
                : state.progress.completedPassages || []
    );
    const unseen = pool.filter(item => !completedIds.has(item.id));
    if (unseen.length) {
        return unseen[Math.floor(Math.random() * unseen.length)];
    }

    const history = state.sessions.filter(s => s.contentType === type);
    if (!history.length) {
        return pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
    }

    const lastPlayed = new Map();
    history.forEach(s => lastPlayed.set(s.contentId, new Date(s.ts).getTime()));
    return [...pool].sort((a, b) => (lastPlayed.get(a.id) || 0) - (lastPlayed.get(b.id) || 0))[0] || null;
}

// --- 3. UI ROUTING & RENDERING ---
function showScreen(screenName) {
    // Clean up previous screen's event listeners
    if (state.runtime?._cleanupSummaryKeys) {
        state.runtime._cleanupSummaryKeys();
        state.runtime._cleanupSummaryKeys = null;
    }
    
    state.ui.currentScreen = screenName;
    mainContent.innerHTML = getScreenHtml(screenName, state, DATA);
    bindScreenEvents(screenName);
    if (screenName === 'summary' && state.runtime.summaryResults?.newBadges?.length > 0) {
        triggerConfetti();
    }
    window.scrollTo(0, 0);
}

function showModal(modalName, options = {}) {
    state.ui.lastFocus = document.activeElement;
    state.ui.modal = modalName;
    modalContainer.innerHTML = getModalHtml(modalName, state, DATA);
    
    // Reset lesson picker state every time it's opened
    if (modalName === 'lessonPicker') {
        resetLessonPickerState(state.settings.defaultStage);
    }

    bindModalEvents(modalName);
    const modal = modalContainer.querySelector('.modal');
    modal.classList.add('active');
    const firstInput = modal.querySelector('input, select, button');
    if (firstInput) firstInput.focus();
    if (options.scrollToId) {
        const target = modal.querySelector(`#${options.scrollToId}`);
        if (target) {
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }
}

function closeModal() {
    const modalEl = modalContainer.querySelector('.modal');
    if (modalEl) {
        if (state.ui.modal === 'welcome') {
            markWelcomeSeen();
        }
        modalEl.classList.remove('active');
        setTimeout(() => {
            modalContainer.innerHTML = '';
            state.ui.modal = null;
            if (state.ui.lastFocus) state.ui.lastFocus.focus();
        }, 200);
    }
}

// --- 4. EVENT BINDING ---
function bindAppEvents() {
    document.getElementById('about-btn').addEventListener('click', () => showModal('about'));
    document.getElementById('help-btn').addEventListener('click', () => showModal('help'));
    document.getElementById('start-here-btn').addEventListener('click', () => showModal('welcome'));
    document.getElementById('settings-btn').addEventListener('click', () => showModal('settings'));
    document.getElementById('parent-btn').addEventListener('click', () => {
        state.settings.pin ? showModal('pin') : showModal('parent');
    });
    const footerPrivacyLink = document.getElementById('footer-privacy-link');
    if (footerPrivacyLink) {
        footerPrivacyLink.addEventListener('click', () => showModal('help', { scrollToId: 'help-data-privacy' }));
    }
    window.addEventListener('keydown', e => { if (e.key === 'Escape' && state.ui.modal) closeModal(); });
    window.addEventListener('blur', () => { if (state.runtime && state.runtime.timer) state.runtime.timer.paused = true; });
    window.addEventListener('focus', () => { if (state.runtime && state.runtime.timer) state.runtime.timer.paused = false; });
}

function bindScreenEvents(screenName) {
    if (screenName === 'home') {
        // Resume draft button handler
        const resumeBtn = document.getElementById('resume-draft-btn');
        if (resumeBtn) {
            resumeBtn.addEventListener('click', () => {
                const draft = loadDraft();
                if (draft && draft.lessonData) {
                    // Start session with saved draft text
                    const onSessionStart = () => {
                        // After a short delay, restore the typed text
                        setTimeout(() => {
                            const input = document.getElementById('typing-input');
                            if (input) {
                                input.value = draft.typedText;
                                input.dispatchEvent(new Event('input', { bubbles: true }));
                            }
                        }, 100);
                    };
                    startSession({ type: draft.lessonType, data: draft.lessonData }, state, (screen) => {
                        showScreen(screen);
                        if (screen === 'typing') onSessionStart();
                    }, saveState);
                }
            });
        }
        
        // Discard draft button handler
        const discardBtn = document.getElementById('discard-draft-btn');
        if (discardBtn) {
            discardBtn.addEventListener('click', () => {
                clearDraft();
                showScreen('home');
                toast('Draft discarded.');
            });
        }

        // Use event delegation for the new story buttons
        document.getElementById('new-story-card').addEventListener('click', async (e) => {
            if (e.target.matches('[data-stage]')) {
                const stage = e.target.dataset.stage;
                
                // Show a loading toast for a better UX, as this might take a moment
                toast(`Finding a new ${stage} story...`);
                await loadStageData(stage); // Ensure the data for this stage is loaded

                const allPassagesForStage = DATA.PASSAGES.filter(p => p.stage === stage);
                const lessonData = pickFreshLesson(allPassagesForStage, 'passage');
                if (!lessonData) {
                    toast(`No ${stage} passages are available yet. Please try another stage.`);
                    return;
                }
                startSession({ type: 'passage', data: lessonData }, state, showScreen, saveState);
            }

            if (e.target.matches('[data-spelling-stage]')) {
                const stage = e.target.dataset.spellingStage;
                const stageSpellings = DATA.SPELLING.filter(item => item.stage === stage);

                if (!stageSpellings.length) {
                    toast(`No spelling lists found for ${stage} yet. Please try another stage.`);
                    return;
                }

                const lessonData = pickFreshLesson(stageSpellings, 'spelling');
                if (!lessonData) {
                    toast(`No fresh spelling lists found for ${stage}. Please try another stage.`);
                    return;
                }
                startSession({ type: 'spelling', data: lessonData }, state, showScreen, saveState);
            }
        });

        const phonicsBtn = document.getElementById('phonics-mode-btn');
        if (phonicsBtn) {
            phonicsBtn.addEventListener('click', () => {
                if (!DATA.PHONICS.length) {
                    toast('Phonics passages are still loading. Please try again in a moment.');
                    return;
                }
                const lessonData = pickFreshLesson(DATA.PHONICS, 'phonics');
                if (!lessonData) {
                    toast('No phonics passages available yet. Please try again later.');
                    return;
                }
                startSession({ type: 'phonics', data: lessonData }, state, showScreen, saveState);
            });
        }

        document.getElementById('browse-lessons-btn').addEventListener('click', () => showModal('lessonPicker'));

        const viewBadgesBtn = document.getElementById('view-badges-btn');
        if (viewBadgesBtn) {
            viewBadgesBtn.addEventListener('click', () => showModal('badges'));
        }
    }
    if (screenName === 'typing') {
        requestAnimationFrame(() => calculateVisualLines(state, DATA));
        window.addEventListener('resize', debounce(() => calculateVisualLines(state, DATA), 250));

        const input = document.getElementById('typing-input');
        
        // Session end callback with draft clearing
        const sessionEndCallback = (finalInput) => {
            clearDraft();
            endSession(finalInput, state, DATA, showScreen, saveState);
        };
        
        input.addEventListener('input', e => {
            handleTypingInput(e, state, DATA, sessionEndCallback);
            // Auto-save draft every 2 seconds via debounce
            debouncedSaveDraft(state, input.value);
        });
        input.addEventListener('paste', e => { e.preventDefault(); toast(DATA.COPY.pasteBlocked); });
        
        document.getElementById('lockstep-toggle').addEventListener('change', e => { state.runtime.flags.lockstep = e.target.checked; });
        document.getElementById('focusline-toggle').addEventListener('change', e => { 
            state.runtime.flags.focusLine = e.target.checked; 
            document.getElementById('typing-target').classList.toggle('focus-line-active', e.target.checked); 
        });
        document.getElementById('back-to-home-btn').addEventListener('click', () => {
            if (confirm('Are you sure you want to exit? Your progress will be saved as a draft.')) {
                // Save draft before exiting
                const lessonId = state.runtime.lesson?.data?.id;
                const lessonType = state.runtime.lesson?.type;
                if (lessonId && input.value.length > 0) {
                    saveDraft(lessonId, lessonType, input.value, state.runtime.lesson.data);
                    toast('Draft saved. You can resume later.');
                }
                showScreen('home');
            }
        });
        input.focus();

        if (state.runtime.flags.timer) {
            const chip = document.getElementById('timer-chip');
            const tick = () => {
                if (state.runtime.timer.paused) return;
                const timerEndCallback = (finalInput) => {
                    clearDraft();
                    endSession(finalInput, state, DATA, showScreen, saveState);
                };

                if (state.runtime.flags.countdownTimer) {
                    state.runtime.timer.remaining--;
                    if (chip) {
                        chip.textContent = `00:${String(state.runtime.timer.remaining).padStart(2, '0')}`;
                    }
                    if (state.runtime.timer.remaining <= 0) {
                        clearInterval(state.runtime.timer.handle);
                        timerEndCallback(document.getElementById('typing-input').value);
                    }
                } else {
                    const sec = Math.floor((new Date() - state.runtime.startTime) / 1000);
                    const m = String(Math.floor(sec / 60)).padStart(2, '0');
                    const s = String(sec % 60).padStart(2, '0');
                    if (chip) {
                        chip.textContent = `${m}:${s}`;
                    }
                }
            };
            state.runtime.timer.handle = setInterval(tick, 1000);
            tick();
        }
    }
    if (screenName === 'summary') {
        const replayBtn = document.getElementById('replay-btn');
        if (replayBtn) replayBtn.addEventListener('click', () => startSession(state.runtime.lesson, state, showScreen, saveState));
        
        const drillBtn = document.getElementById('start-drill-btn');
        if (drillBtn) drillBtn.addEventListener('click', () => startFocusDrill(state, DATA, showScreen, saveState));
        
        document.getElementById('home-btn').addEventListener('click', () => showScreen('home'));
        
        // Keyboard shortcuts for summary screen
        const summaryKeyHandler = (e) => {
            if (e.key === 'Enter' && replayBtn && !state.runtime.summaryResults.isDrill) {
                startSession(state.runtime.lesson, state, showScreen, saveState);
            } else if (e.key === 'Escape') {
                showScreen('home');
            }
        };
        window.addEventListener('keydown', summaryKeyHandler);
        // Clean up when leaving the screen
        state.runtime._cleanupSummaryKeys = () => window.removeEventListener('keydown', summaryKeyHandler);
    }
}

function bindModalEvents(modalName) {
    const modalEl = modalContainer.querySelector('.modal');
    const contentEl = modalEl.querySelector('.modal-content');

    const closeHandler = () => closeModal();

    modalEl.querySelector('#close-modal-btn')?.addEventListener('click', closeHandler);
    modalEl.addEventListener('click', e => { if (e.target === modalEl) closeHandler(); });
    
    const focusables = Array.from(contentEl.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'));
    if (focusables.length > 0) {
        const first = focusables[0], last = focusables[focusables.length - 1];
        contentEl.addEventListener('keydown', e => {
            if (e.key === 'Tab') {
                if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
                else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
            }
        });
    }

    if (modalName === 'lessonPicker') {
        const stageFilter = modalContainer.querySelector('.stage-filter');
        const searchInput = document.getElementById('search-input');
        const sortSelect = document.getElementById('sort-select');
        const lessonListEl = modalContainer.querySelector('.lesson-list');

        const setStageFilterVisibility = (type) => {
            if (stageFilter) {
                stageFilter.parentElement.classList.toggle('hidden', type === 'phonics');
            }
        };
        
        const handleFilterChange = async (updates) => {
            lessonListEl.classList.add('loading');
            if (updates.currentStage) {
                await loadStageData(updates.currentStage);
            }
            // Use a small timeout to let the loading class apply before heavy filtering/sorting
            setTimeout(() => updateLessonPicker(updates, state, DATA), 50);
        };
        
        modalContainer.querySelectorAll('.tab-button').forEach(b => b.addEventListener('click', (e) => {
            modalContainer.querySelector('.tab-button.active').classList.remove('active');
            e.target.classList.add('active');
            const newType = e.target.dataset.type;
            setStageFilterVisibility(newType);
            handleFilterChange({ currentType: newType, currentPage: 1 });
        }));

        stageFilter.querySelectorAll('.button').forEach(b => b.addEventListener('click', (e) => {
            stageFilter.querySelector('.active').classList.remove('active');
            e.target.classList.add('active');
            handleFilterChange({ currentStage: e.target.dataset.stage, currentPage: 1 });
        }));

        searchInput.addEventListener('input', debounce(() => {
            handleFilterChange({ searchTerm: searchInput.value, currentPage: 1 });
        }, 300));

        sortSelect.addEventListener('change', () => {
            handleFilterChange({ sortKey: sortSelect.value, currentPage: 1 });
        });

        lessonListEl.addEventListener('click', (e) => {
            // Only start lesson when clicking the Start button
            const startBtn = e.target.closest('[data-start]');
            if (!startBtn) return;
            
            const item = e.target.closest('.lesson-item');
            if (item) {
                const { id, type } = item.dataset;
                const poolMap = { passage: DATA.PASSAGES, phonics: DATA.PHONICS, spelling: DATA.SPELLING, wordset: DATA.WORDSETS };
                const pool = poolMap[type] || DATA.PASSAGES;
                const lessonData = pool.find(l => l.id === id);
                if (lessonData) {
                    closeModal();
                    startSession({ type, data: lessonData }, state, showScreen, saveState);
                }
            }
        });

        // Event delegation for pagination controls (bound once, not on every render)
        const paginationEl = modalContainer.querySelector('.pagination-controls');
        paginationEl.addEventListener('click', (e) => {
            const action = e.target.dataset.action;
            if (action) {
                handleLessonPickerPagination(action);
            }
        });

        // Initial load and render – ensure the default stage data is available
        stageFilter.querySelector(`[data-stage="${state.settings.defaultStage}"]`).classList.add('active');
        const pickerState = getLessonPickerState();
        setStageFilterVisibility(pickerState.currentType);
        handleFilterChange({ currentStage: pickerState.currentStage });
    }
    if (modalName === 'welcome') {
        const startButton = document.getElementById('welcome-start-btn');
        startButton?.addEventListener('click', closeModal);
    }
    if (modalName === 'settings') {
        const s = state.settings;
        document.getElementById('setting-theme').value = s.theme;
        document.getElementById('setting-font').value = s.font;
        document.getElementById('setting-line-height').value = s.lineHeight;
        document.getElementById('setting-letter-spacing').value = s.letterSpacing;
        document.getElementById('setting-lockstep').checked = s.lockstepDefault;
        document.getElementById('setting-focusline').checked = s.focusLineDefault;
        document.getElementById('setting-keyboard').checked = s.keyboardHintDefault;
        document.getElementById('setting-timer-display').checked = s.showTimerDisplay;
        document.getElementById('setting-default-stage').value = s.defaultStage;
        document.getElementById('lh-val').textContent = s.lineHeight;
        document.getElementById('ls-val').textContent = `+${s.letterSpacing}%`;

        document.getElementById('setting-line-height').addEventListener('input', e => document.getElementById('lh-val').textContent = e.target.value);
        document.getElementById('setting-letter-spacing').addEventListener('input', e => document.getElementById('ls-val').textContent = `+${e.target.value}%`);
        
        document.getElementById('save-settings-btn').addEventListener('click', async () => {
            s.theme = document.getElementById('setting-theme').value;
            s.font = document.getElementById('setting-font').value;
            s.lineHeight = document.getElementById('setting-line-height').value;
            s.letterSpacing = document.getElementById('setting-letter-spacing').value;
            s.lockstepDefault = document.getElementById('setting-lockstep').checked;
            s.focusLineDefault = document.getElementById('setting-focusline').checked;
            s.keyboardHintDefault = document.getElementById('setting-keyboard').checked;
            s.showTimerDisplay = document.getElementById('setting-timer-display').checked;
            s.defaultStage = document.getElementById('setting-default-stage').value;
            
            const newPin = document.getElementById('setting-pin').value;
            if (/^\d{4}$/.test(newPin)) s.pin = await sha256Hex(newPin);
            
            applySettings(s, state.progress);
            saveState();
            closeModal();
        });
    }
    if (modalName === 'parent') {
        document.getElementById('export-btn').addEventListener('click', () => {
            const timestamp = new Date().toISOString().slice(0, 16).replace(/[T:]/g, '-');
            const dataStr = JSON.stringify({ _v: SCHEMA_VERSION, appVersion: APP_VERSION, state }, null, 2);
            const blob = new Blob([dataStr], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = `storykeys-backup-${timestamp}.json`;
            a.click();
            URL.revokeObjectURL(url);
        });
        document.getElementById('clear-data-btn').addEventListener('click', () => {
            if (confirm('Really clear all progress? This cannot be undone.')) {
                localStorage.removeItem('storykeys_state');
                location.reload();
            }
        });
    }
    if (modalName === 'badges') {
        const printBtn = document.getElementById('print-certificate-btn');
        if (printBtn) {
            printBtn.addEventListener('click', () => printCertificate(state, DATA));
        }
    }
    if (modalName === 'pin') {
        const pinInput = document.getElementById('pin-input');
        pinInput.focus();
        const submit = async () => {
            const ok = state.settings.pin && await sha256Hex(pinInput.value) === state.settings.pin;
            if (ok) {
                closeModal();
                showModal('parent');
            } else {
                alert('Incorrect PIN.');
                pinInput.value = '';
                pinInput.focus();
            }
        };
        pinInput.addEventListener('input', () => { if (pinInput.value.length === 4) submit(); });
        document.getElementById('pin-submit-btn').addEventListener('click', submit);
    }
}

// --- 5. APP INITIALIZATION ---
async function init() {
    const loadingOverlay = document.getElementById('loading-overlay');
    const appContainer = document.getElementById('app-container');

    try {
        await loadInitialData();
        loadState();
        applySettings(state.settings, state.progress);
        showScreen('home');
        bindAppEvents();

        if (shouldShowWelcome()) {
            showModal('welcome');
        }

        // Pass a reference to the DATA object to a global scope for the pagination controls
        // This is a small workaround to avoid complex event bubbling or state management libraries
        window.StoryKeys = { DATA };

        loadingOverlay.style.opacity = '0';
        appContainer.style.display = 'block';
        setTimeout(() => loadingOverlay.style.display = 'none', 300);

    } catch (error) {
        console.error("Initialization failed:", error);
        const errorEl = document.getElementById('loading-error');
        errorEl.textContent = "Data failed to load. Please check your connection and refresh the page.";
        errorEl.style.display = 'block';
    }
}

// Start the application once the DOM is ready.
document.addEventListener('DOMContentLoaded', init);
