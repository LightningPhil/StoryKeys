/**
 * @file main.js
 * @description Main application controller for the StoryKeys typing tutor.
 * This file initializes the app, manages state, and wires up event listeners,
 * delegating logic to imported modules.
 */

// --- MODULE IMPORTS ---
import { DATA, loadAllData } from './dataLoader.js';
import { applySettings, getScreenHtml, getModalHtml, renderLessonList, triggerConfetti, toast } from './ui.js';
import { startSession, endSession, startFocusDrill } from './lessons.js';
import { sha256Hex, debounce } from './utils.js';
import { handleTypingInput, calculateVisualLines } from './keyboard.js';

'use strict';
const APP_VERSION = "7.0.0";
const SCHEMA_VERSION = 1;

// --- 1. STATE MANAGEMENT ---
let state = {
    settings: { font: 'default', lineHeight: 1.7, letterSpacing: 2, theme: 'cream', lockstepDefault: true, focusLineDefault: false, keyboardHintDefault: false, defaultStage: 'KS2', pin: null },
    progress: { minutesTotal: 0, wordsTotal: 0, badges: [], themesCompleted: {}, stagesCompleted: {}, lastPlayed: null, consecutiveDays: 0 },
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
        // Could clear the broken state here if desired:
        // localStorage.removeItem('storykeys_state');
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
        document.getElementById('start-random-btn').addEventListener('click', () => {
            const pool = DATA.PASSAGES.filter(l => l.stage === state.settings.defaultStage);
            if (pool.length > 0) {
                const lesson = { type: 'passage', data: pool[Math.floor(Math.random() * pool.length)] };
                startSession(lesson, state, showScreen);
            } else {
                toast(`No passages found for stage ${state.settings.defaultStage}.`);
            }
        });
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

                if (state.runtime.isDrill) {
                    state.runtime.timer.remaining--;
                    chip.textContent = `00:${String(state.runtime.timer.remaining).padStart(2, '0')}`;
                    if (state.runtime.timer.remaining <= 0) {
                        clearInterval(state.runtime.timer.handle);
                        sessionEndCallback(document.getElementById('typing-input').value);
                    }
                } else {
                    const sec = Math.floor((new Date() - state.runtime.startTime) / 1000);
                    const m = String(Math.floor(sec / 60)).padStart(2, '0');
                    const s = String(sec % 60).padStart(2, '0');
                    chip.textContent = `${m}:${s}`;
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

    // Close button and background click
    modalEl.querySelector('#close-modal-btn')?.addEventListener('click', closeModal);
    modalEl.addEventListener('click', e => { if (e.target === modalEl) closeModal(); });
    
    // Focus trapping for accessibility
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
        modalContainer.querySelectorAll('.tab-button, .stage-filter .button').forEach(b => b.addEventListener('click', (e) => {
            const group = e.target.closest('.button-group, .tabs');
            group.querySelector('.active').classList.remove('active');
            e.target.classList.add('active');
            renderLessonList(state, DATA);
        }));
        modalContainer.querySelector('.lesson-list').addEventListener('click', (e) => {
            const item = e.target.closest('.lesson-item');
            if (item) {
                const { id, type } = item.dataset;
                const pool = type === 'passage' ? DATA.PASSAGES : DATA.WORDSETS;
                const lessonData = pool.find(l => l.id === id);
                if (lessonData) {
                    const lesson = { type, data: lessonData, withTimer: modalContainer.querySelector('#option-timer').checked };
                    closeModal();
                    startSession(lesson, state, showScreen);
                }
            }
        });
        stageFilter.querySelector(`[data-stage="${state.settings.defaultStage}"]`).classList.add('active');
        renderLessonList(state, DATA);
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
        // Await the data loading process
        await loadAllData();

        // Once data is loaded, proceed with the app setup
        loadState();
        applySettings(state.settings, state.progress);
        showScreen('home');
        bindAppEvents();

        // Hide loading screen and show the app
        loadingOverlay.style.opacity = '0';
        appContainer.style.display = 'block';
        setTimeout(() => loadingOverlay.style.display = 'none', 300);

    } catch (error) {
        // If data loading fails, show an error message
        console.error("Initialization failed:", error);
        const errorEl = document.getElementById('loading-error');
        errorEl.textContent = "Data failed to load. Please check the data files and your connection, then refresh the page.";
        errorEl.style.display = 'block';
    }
}

// Start the application once the DOM is ready.
document.addEventListener('DOMContentLoaded', init);