/**
 * @file main.js
 * @description Main application controller for the StoryKeys typing tutor. (Version 8.0 - Stage 2)
 * This file initializes the app, manages state, and wires up event listeners,
 * delegating logic to imported modules.
 */

// --- MODULE IMPORTS ---
import { config } from './config.js';
import { DATA, loadInitialData, loadStageData } from './dataLoader.js';
import { applySettings, getScreenHtml, getModalHtml, updateLessonPicker, resetLessonPickerState, triggerConfetti, toast } from './ui.js';
import { startSession, endSession, startFocusDrill } from './lessons.js';
import { sha256Hex, debounce } from './utils.js';
import { handleTypingInput, calculateVisualLines } from './keyboard.js';

'use strict';
const APP_VERSION = "8.0.0";
const SCHEMA_VERSION = 1;

// --- 1. STATE MANAGEMENT ---
let state = {
    settings: { font: 'default', lineHeight: 1.7, letterSpacing: 2, theme: 'cream', lockstepDefault: true, focusLineDefault: false, keyboardHintDefault: false, showTimerDisplay: true, defaultStage: 'KS2', pin: null },
    progress: { minutesTotal: 0, wordsTotal: 0, badges: [], themesCompleted: {}, stagesCompleted: {}, lastPlayed: null, consecutiveDays: 0, completedPassages: [] },
    sessions: [],
    ui: { currentScreen: 'home', modal: null, lastFocus: null },
    runtime: {},
};

function saveState() {
    localStorage.setItem('storykeys_state', JSON.stringify({ ...state, _v: SCHEMA_VERSION }));
}

function loadState() {
    const raw = localStorage.getItem('storykeys_state');
    if (!raw) return;
    try {
        const parsed = JSON.parse(raw);
        state.settings = { ...state.settings, ...parsed.settings };
        state.progress = { ...state.progress, ...parsed.progress };
        state.sessions = parsed.sessions || [];
    } catch (e) {
        console.error("Failed to parse state from localStorage:", e);
    }
}

// --- 2. DOM REFERENCES ---
const mainContent = document.getElementById('main-content');
const modalContainer = document.getElementById('modal-container');

// --- 3. UI ROUTING & RENDERING ---
function showScreen(screenName) {
    state.ui.currentScreen = screenName;
    mainContent.innerHTML = getScreenHtml(screenName, state, DATA);
    bindScreenEvents(screenName);
    if (screenName === 'summary' && state.runtime.summaryResults?.newBadges?.length > 0) {
        triggerConfetti();
    }
    window.scrollTo(0, 0);
}

function showModal(modalName) {
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
}

function closeModal() {
    const modalEl = modalContainer.querySelector('.modal');
    if (modalEl) {
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
    document.getElementById('settings-btn').addEventListener('click', () => showModal('settings'));
    document.getElementById('parent-btn').addEventListener('click', () => {
        state.settings.pin ? showModal('pin') : showModal('parent');
    });
    window.addEventListener('keydown', e => { if (e.key === 'Escape' && state.ui.modal) closeModal(); });
    window.addEventListener('blur', () => { if (state.runtime && state.runtime.timer) state.runtime.timer.paused = true; });
    window.addEventListener('focus', () => { if (state.runtime && state.runtime.timer) state.runtime.timer.paused = false; });
}

function bindScreenEvents(screenName) {
    if (screenName === 'home') {
        // Use event delegation for the new story buttons
        document.getElementById('new-story-card').addEventListener('click', async (e) => {
            if (e.target.matches('[data-stage]')) {
                const stage = e.target.dataset.stage;
                
                // Show a loading toast for a better UX, as this might take a moment
                toast(`Finding a new ${stage} story...`);
                await loadStageData(stage); // Ensure the data for this stage is loaded

                const allPassagesForStage = DATA.PASSAGES.filter(p => p.stage === stage);
                
                // Create a Set of completed IDs for efficient lookup
                const completedIds = new Set(state.progress.completedPassages || []);
                
                // Filter out any passages that have already been completed
                const newPassages = allPassagesForStage.filter(p => !completedIds.has(p.id));

                if (newPassages.length === 0) {
                    // Handle the case where the user has completed everything
                    toast(`Congratulations! You've finished all the new stories for ${stage}.`);
                    return;
                }

                // Select a random passage from the remaining new ones
                const lessonData = newPassages[Math.floor(Math.random() * newPassages.length)];
                startSession({ type: 'passage', data: lessonData }, state, showScreen);
            }
        });

        const phonicsBtn = document.getElementById('phonics-mode-btn');
        if (phonicsBtn) {
            phonicsBtn.addEventListener('click', () => {
                if (!DATA.PHONICS.length) {
                    toast('Phonics passages are still loading. Please try again in a moment.');
                    return;
                }
                const lessonData = DATA.PHONICS[Math.floor(Math.random() * DATA.PHONICS.length)];
                startSession({ type: 'phonics', data: lessonData }, state, showScreen);
            });
        }

        document.getElementById('browse-lessons-btn').addEventListener('click', () => showModal('lessonPicker'));
    }
    if (screenName === 'typing') {
        requestAnimationFrame(() => calculateVisualLines(state, DATA));
        window.addEventListener('resize', debounce(() => calculateVisualLines(state, DATA), 250));

        const input = document.getElementById('typing-input');
        input.addEventListener('input', e => handleTypingInput(e, state, DATA, (finalInput) => endSession(finalInput, state, DATA, showScreen, saveState)));
        input.addEventListener('paste', e => { e.preventDefault(); toast(DATA.COPY.pasteBlocked); });
        
        document.getElementById('lockstep-toggle').addEventListener('change', e => { state.runtime.flags.lockstep = e.target.checked; });
        document.getElementById('focusline-toggle').addEventListener('change', e => { 
            state.runtime.flags.focusLine = e.target.checked; 
            document.getElementById('typing-target').classList.toggle('focus-line-active', e.target.checked); 
        });
        document.getElementById('back-to-home-btn').addEventListener('click', () => {
            if (confirm('Are you sure you want to exit? Your progress in this session will be lost.')) {
                showScreen('home');
            }
        });
        input.focus();

        if (state.runtime.flags.timer) {
            const chip = document.getElementById('timer-chip');
            const tick = () => {
                if (state.runtime.timer.paused) return;
                const sessionEndCallback = (finalInput) => endSession(finalInput, state, DATA, showScreen, saveState);

                if (state.runtime.flags.countdownTimer) {
                    state.runtime.timer.remaining--;
                    if (chip) {
                        chip.textContent = `00:${String(state.runtime.timer.remaining).padStart(2, '0')}`;
                    }
                    if (state.runtime.timer.remaining <= 0) {
                        clearInterval(state.runtime.timer.handle);
                        sessionEndCallback(document.getElementById('typing-input').value);
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
        if (replayBtn) replayBtn.addEventListener('click', () => startSession(state.runtime.lesson, state, showScreen));
        
        const drillBtn = document.getElementById('start-drill-btn');
        if (drillBtn) drillBtn.addEventListener('click', () => startFocusDrill(state, DATA, showScreen));
        
        document.getElementById('home-btn').addEventListener('click', () => showScreen('home'));
    }
}

function bindModalEvents(modalName) {
    const modalEl = modalContainer.querySelector('.modal');
    const contentEl = modalEl.querySelector('.modal-content');

    modalEl.querySelector('#close-modal-btn')?.addEventListener('click', closeModal);
    modalEl.addEventListener('click', e => { if (e.target === modalEl) closeModal(); });
    
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
                stageFilter.style.display = type === 'phonics' ? 'none' : '';
            }
        };
        
        const handleFilterChange = async (updates) => {
            lessonListEl.classList.add('loading');
            if (updates.currentStage) {
                await loadStageData(updates.currentStage);
            }
            // Use a small timeout to let the loading class apply before heavy filtering/sorting
            setTimeout(() => updateLessonPicker(updates, DATA), 50);
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
            const item = e.target.closest('.lesson-item');
            if (item) {
                const { id, type } = item.dataset;
                const pool = type === 'passage' ? DATA.PASSAGES : (type === 'phonics' ? DATA.PHONICS : DATA.WORDSETS);
                const lessonData = pool.find(l => l.id === id);
                if (lessonData) {
                    closeModal();
                    startSession({ type, data: lessonData }, state, showScreen);
                }
            }
        });

        // Initial load and render
        stageFilter.querySelector(`[data-stage="${state.settings.defaultStage}"]`).classList.add('active');
        setStageFilterVisibility(lessonPickerState.currentType);
        handleFilterChange({});
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