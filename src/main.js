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
import { sha256Hex, debounce, normaliseString } from './utils.js';
import { handleTypingInput, calculateVisualLines } from './keyboard.js';
import { speakText, stopSpeaking, isSpeaking, isSpeechAvailable, prepareSpeech, prepareSpeechBatch, isSpeechReady, getVoices, initializeKokoro, initAudioKeepAlive } from './sounds.js';

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
    settings: { font: 'default', lineHeight: 1.7, letterSpacing: 2, theme: 'cream', lockstepDefault: true, focusLineDefault: true, keyboardHintDefault: false, showTimerDisplay: true, defaultStage: 'KS2', pin: null, soundEnabled: false, fingerGuide: false, reduceMotion: false, voiceLanguage: 'en-us', voice: 'af_bella', voiceSpeed: 1.0, highQualitySpeech: false },
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
    
    // Clean up recall mode if leaving typing screen
    if (state.runtime?._cleanupRecallMode) {
        state.runtime._cleanupRecallMode();
        state.runtime._cleanupRecallMode = null;
    }
    
    // Stop any ongoing speech when changing screens
    stopSpeaking();
    
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

    // Prevent background scrolling while modal is open
    document.body.classList.add('modal-open');

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
        document.body.classList.remove('modal-open');
        setTimeout(() => {
            modalContainer.innerHTML = '';
            state.ui.modal = null;
            if (state.ui.lastFocus) state.ui.lastFocus.focus();
        }, 200);
    }
}

// --- 4. EVENT BINDING ---
function bindAppEvents() {
    document.getElementById('about-btn').addEventListener('click', () => {
        // If in a modal, close it first
        closeModal();
        // If on typing screen, confirm before leaving (and save draft)
        if (state.ui.screen === 'typing') {
            stopSpeaking();
            if (state.runtime._cleanupPauseHandler) state.runtime._cleanupPauseHandler();
            if (state.runtime.wpmSampleInterval) clearInterval(state.runtime.wpmSampleInterval);
            const input = document.getElementById('typing-input');
            const typedText = input ? input.value : '';
            
            // Always confirm if on typing screen
            if (confirm('Exit lesson? Your progress will be saved as a draft.')) {
                const lessonId = state.runtime.lesson?.data?.id;
                const lessonType = state.runtime.lesson?.type;
                if (lessonId) {
                    saveDraft(lessonId, lessonType, typedText, state.runtime.lesson.data);
                    if (typedText.length > 0) {
                        toast('Draft saved. You can resume later.');
                    }
                }
                showScreen('home');
            }
            return;
        }
        showScreen('home');
    });
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

                // Store the stage for the modal and show mode chooser
                state.ui.spellingModeStage = stage;
                showModal('spellingMode');
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
        
        // Recent lessons click handler
        const recentList = document.querySelector('.recent-lessons-list');
        if (recentList) {
            recentList.addEventListener('click', (e) => {
                const btn = e.target.closest('.recent-lesson-btn');
                if (!btn) return;
                const id = btn.dataset.recentId;
                const type = btn.dataset.recentType;
                
                // Find the lesson in the appropriate data array
                let lessonData = null;
                if (type === 'passage') {
                    lessonData = DATA.PASSAGES.find(p => p.id === id);
                } else if (type === 'spelling') {
                    lessonData = DATA.SPELLING.find(s => s.id === id);
                } else if (type === 'phonics') {
                    lessonData = DATA.PHONICS.find(p => p.id === id);
                } else if (type === 'wordset') {
                    lessonData = DATA.WORDSETS.find(w => w.id === id);
                }
                
                if (lessonData) {
                    startSession({ type, data: lessonData }, state, showScreen, saveState);
                } else {
                    toast('Could not find that lesson. It may have been removed.');
                }
            });
        }
    }
    if (screenName === 'typing') {
        requestAnimationFrame(() => calculateVisualLines(state, DATA));
        window.addEventListener('resize', debounce(() => calculateVisualLines(state, DATA), 250));

        const input = document.getElementById('typing-input');
        const progressBar = document.getElementById('typing-progress-bar');
        const pauseOverlay = document.getElementById('pause-overlay');
        const capsLockIndicator = document.getElementById('caps-lock-indicator');
        
        // Caps Lock detection
        const updateCapsLockState = (e) => {
            if (capsLockIndicator && e.getModifierState) {
                const capsOn = e.getModifierState('CapsLock');
                capsLockIndicator.classList.toggle('active', capsOn);
            }
        };
        
        // Listen for keydown/keyup to detect caps lock state
        input.addEventListener('keydown', updateCapsLockState);
        input.addEventListener('keyup', updateCapsLockState);
        
        // Initialize WPM sampling for sparkline
        state.runtime.wpmSamples = [];
        state.runtime.wpmSampleInterval = null;
        
        // Session end callback with draft clearing
        const sessionEndCallback = (finalInput) => {
            clearDraft();
            if (state.runtime.wpmSampleInterval) clearInterval(state.runtime.wpmSampleInterval);
            endSession(finalInput, state, DATA, showScreen, saveState);
        };
        
        // Update progress bar based on typed characters
        const updateProgressBar = () => {
            if (progressBar && state.runtime.targetTextNorm) {
                const typed = input.value.length;
                const total = state.runtime.targetTextNorm.length;
                const percent = Math.min(100, (typed / total) * 100);
                progressBar.style.width = `${percent}%`;
            }
        };
        
        // For recall mode, skip the standard typing handler - we use a custom one
        const isRecallMode = state.runtime.lesson?.mode === 'recall';
        
        input.addEventListener('input', e => {
            if (!isRecallMode) {
                handleTypingInput(e, state, DATA, sessionEndCallback);
                updateProgressBar();
            }
            // Auto-save draft every 2 seconds via debounce
            debouncedSaveDraft(state, input.value);
            
            // Start WPM sampling once typing begins
            if (!state.runtime.wpmSampleInterval && state.runtime.timer?.started) {
                state.runtime.wpmSampleInterval = setInterval(() => {
                    if (state.runtime.startTime && !state.runtime.timer.paused) {
                        const elapsed = (new Date() - state.runtime.startTime) / 1000;
                        if (elapsed > 0) {
                            const wordsTyped = input.value.length / 5;
                            const wpm = Math.round((wordsTyped / elapsed) * 60);
                            state.runtime.wpmSamples.push(wpm);
                        }
                    }
                }, 3000); // Sample every 3 seconds
            }
        });
        input.addEventListener('paste', e => { e.preventDefault(); toast(DATA.COPY.pasteBlocked); });
        
        const lockstepToggle = document.getElementById('lockstep-toggle');
        const focuslineToggle = document.getElementById('focusline-toggle');
        
        if (lockstepToggle) {
            lockstepToggle.addEventListener('change', e => { state.runtime.flags.lockstep = e.target.checked; });
        }
        if (focuslineToggle) {
            focuslineToggle.addEventListener('change', e => { 
                state.runtime.flags.focusLine = e.target.checked; 
                document.getElementById('typing-target').classList.toggle('focus-line-active', e.target.checked); 
            });
        }
        
        // Pause/Resume functionality
        const togglePause = () => {
            if (!state.runtime.timer?.started) return; // Can't pause if not started
            const isPaused = !state.runtime.timer.paused;
            state.runtime.timer.paused = isPaused;
            pauseOverlay?.classList.toggle('hidden', !isPaused);
            if (isPaused) {
                input.blur();
                state.runtime.pauseStartTime = new Date();
            } else {
                // Adjust startTime to account for pause duration
                if (state.runtime.pauseStartTime) {
                    const pauseDuration = new Date() - state.runtime.pauseStartTime;
                    state.runtime.startTime = new Date(state.runtime.startTime.getTime() + pauseDuration);
                }
                input.focus();
            }
        };
        
        // Escape to pause, Space to resume when paused
        const pauseKeyHandler = (e) => {
            if (e.key === 'Escape') {
                if (state.runtime.timer?.paused) {
                    togglePause(); // Resume
                } else if (state.runtime.timer?.started) {
                    togglePause(); // Pause
                }
            } else if (e.key === ' ' && state.runtime.timer?.paused) {
                e.preventDefault();
                togglePause(); // Resume
            }
        };
        window.addEventListener('keydown', pauseKeyHandler);
        state.runtime._cleanupPauseHandler = () => window.removeEventListener('keydown', pauseKeyHandler);
        // Read Aloud button
        const readAloudBtn = document.getElementById('read-aloud-btn');
        const getSpeechOptions = () => ({
            voice: state.settings.voice,
            language: state.settings.voiceLanguage,
            speed: state.settings.voiceSpeed,
            highQuality: state.settings.highQualitySpeech
        });
        const initialSpeechOptions = getSpeechOptions();
        const setButtonBuffering = (btn, isBuffering) => {
            if (!btn) return;
            btn.classList.toggle('buffering', isBuffering);
            if (isBuffering) {
                btn.setAttribute('aria-busy', 'true');
            } else {
                btn.removeAttribute('aria-busy');
            }
        };
        const setReadAloudIdle = () => {
            if (!readAloudBtn) return;
            readAloudBtn.textContent = '🔊 Read Aloud';
            readAloudBtn.classList.remove('speaking');
            setButtonBuffering(readAloudBtn, false);
        };
        const setReadAloudSpeaking = () => {
            if (!readAloudBtn) return;
            readAloudBtn.textContent = '⏹️ Stop';
            readAloudBtn.classList.add('speaking');
            setButtonBuffering(readAloudBtn, false);
        };
        const setReadAloudBuffering = () => {
            if (!readAloudBtn) return;
            readAloudBtn.textContent = '⏹️ Stop';
            readAloudBtn.classList.remove('speaking');
            setButtonBuffering(readAloudBtn, true);
        };
        if (readAloudBtn) {
            if (!isSpeechAvailable(initialSpeechOptions)) {
                readAloudBtn.disabled = true;
                readAloudBtn.title = 'Text-to-speech not available in this browser';
            } else {
                readAloudBtn.addEventListener('click', () => {
                    const speechOptions = getSpeechOptions();
                    if (isSpeaking(speechOptions)) {
                        stopSpeaking();
                        setReadAloudIdle();
                    } else {
                        const textToRead = state.runtime.lesson?.mode === 'recall' && state.runtime.recallDisplayText
                            ? state.runtime.recallDisplayText
                            : state.runtime.targetText;
                        if (speechOptions.highQuality && !isSpeechReady(textToRead, speechOptions)) {
                            setReadAloudBuffering();
                        } else {
                            setReadAloudSpeaking();
                        }
                        void speakText(
                            textToRead,
                            () => setReadAloudIdle(),
                            () => setReadAloudSpeaking(),
                            {
                                ...speechOptions,
                                onBufferStart: setReadAloudBuffering,
                                onBufferEnd: () => setButtonBuffering(readAloudBtn, false)
                            }
                        );
                    }
                });
            }
        }
        if (initialSpeechOptions.highQuality && isSpeechAvailable(initialSpeechOptions)) {
            const readAloudText = state.runtime.lesson?.mode === 'recall' && state.runtime.recallDisplayText
                ? state.runtime.recallDisplayText
                : state.runtime.targetText;
            // Pre-buffer speech for faster playback
            // The queue in sounds.js ensures requests are processed one at a time
            if (state.runtime.lesson?.mode === 'recall') {
                // For recall mode, pre-buffer the list plus each shuffled word
                const words = state.runtime.spellingRecall?.shuffledWords || [];
                if (readAloudText) {
                    void prepareSpeech(readAloudText, initialSpeechOptions);
                }
                void prepareSpeechBatch(words, initialSpeechOptions);
            } else {
                // For tutor mode and passages, buffer the full text
                void prepareSpeech(readAloudText, initialSpeechOptions);
            }
        }
        
        input.focus();

        // Timer setup - but don't start until first correct keystroke
        if (state.runtime.flags.timer) {
            const chip = document.getElementById('timer-chip');
            // Show initial state
            if (chip) {
                if (state.runtime.flags.countdownTimer) {
                    chip.textContent = `01:00`;
                    chip.title = 'Timer starts when you begin typing';
                } else {
                    chip.textContent = `00:00`;
                    chip.title = 'Timer starts when you begin typing';
                }
            }
            
            // Store the tick function so keyboard.js can start it
            state.runtime.timer.tick = () => {
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
            // Timer will be started by keyboard.js on first correct keystroke
        }
        // --- Recall Mode Event Handlers ---
        if (state.runtime.lesson?.mode === 'recall') {
            const recallReadyBtn = document.getElementById('recall-ready-btn');
            const recallSayWordBtn = document.getElementById('recall-say-word-btn');
            const recallCountdown = document.getElementById('recall-countdown');
            const recallCountdownValue = document.getElementById('recall-countdown-value');
            const recallInstruction = document.getElementById('recall-instruction');
            const recallControls = document.getElementById('recall-controls');
            const typingTarget = document.getElementById('typing-target');
            const initialRecallSpeechOptions = getSpeechOptions();
            const setSayWordIdle = () => {
                if (!recallSayWordBtn) return;
                recallSayWordBtn.classList.remove('speaking');
                setButtonBuffering(recallSayWordBtn, false);
            };
            const setSayWordSpeaking = () => {
                if (!recallSayWordBtn) return;
                recallSayWordBtn.classList.add('speaking');
                setButtonBuffering(recallSayWordBtn, false);
            };
            const setSayWordBuffering = () => {
                if (!recallSayWordBtn) return;
                recallSayWordBtn.classList.remove('speaking');
                setButtonBuffering(recallSayWordBtn, true);
            };
            const getCurrentRecallWord = () => {
                const recall = state.runtime.spellingRecall;
                return recall?.shuffledWords?.[recall.currentIndex] || '';
            };
            const lockRecallInput = () => {
                const recall = state.runtime.spellingRecall;
                if (!recall) return;
                recall.inputLocked = true;
                input.disabled = true;
            };
            const unlockRecallInput = () => {
                const recall = state.runtime.spellingRecall;
                if (!recall) return;
                recall.inputLocked = false;
                input.disabled = false;
                input.focus();
            };
            const countRecallErrors = (expected, typed) => {
                const expectedNorm = normaliseString(expected).trim();
                const typedNorm = normaliseString(typed).trim();
                const maxLen = Math.max(expectedNorm.length, typedNorm.length);
                let errors = 0;
                for (let i = 0; i < maxLen; i++) {
                    if (expectedNorm[i] !== typedNorm[i]) {
                        errors++;
                    }
                }
                return errors;
            };
            const speakCurrentRecallWord = (options = {}) => {
                const recall = state.runtime.spellingRecall;
                const currentWord = getCurrentRecallWord();
                if (!recall || !currentWord) return;

                const speechOptions = getSpeechOptions();
                const unlockOnEnd = options.unlockOnEnd !== false;
                const shouldUnlock = unlockOnEnd && recall.inputLocked;

                if (recallSayWordBtn) {
                    recallSayWordBtn.disabled = true;
                }
                if (speechOptions.highQuality && !isSpeechReady(currentWord, speechOptions)) {
                    setSayWordBuffering();
                } else {
                    setSayWordSpeaking();
                }

                void speakText(
                    currentWord,
                    () => {
                        setSayWordIdle();
                        if (recallSayWordBtn) {
                            recallSayWordBtn.disabled = false;
                        }
                        if (shouldUnlock) {
                            unlockRecallInput();
                            recallInstruction.textContent = DATA.COPY.recallTypePrompt || 'Type the word you hear, then press Enter.';
                        }
                        if (options.onEnd) options.onEnd();
                    },
                    () => {
                        setSayWordSpeaking();
                    },
                    {
                        ...speechOptions,
                        onBufferStart: setSayWordBuffering,
                        onBufferEnd: () => setButtonBuffering(recallSayWordBtn, false)
                    }
                );
            };
            
            // Disable speech buttons if not available
            if (!isSpeechAvailable(initialRecallSpeechOptions)) {
                if (readAloudBtn) {
                    readAloudBtn.disabled = true;
                    readAloudBtn.title = DATA.COPY.speechNotAvailable || 'Text-to-speech not available';
                }
                recallSayWordBtn.disabled = true;
                recallSayWordBtn.title = DATA.COPY.speechNotAvailable || 'Text-to-speech not available';
            }
            
            // Ready button click - starts countdown
            recallReadyBtn?.addEventListener('click', () => {
                // Hide word list
                typingTarget.classList.add('recall-hidden');
                recallControls.dataset.phase = 'countdown';
                recallReadyBtn.classList.add('hidden');
                recallCountdown.classList.remove('hidden');
                
                // Stop any ongoing speech
                stopSpeaking();
                if (readAloudBtn) {
                    setReadAloudIdle();
                    readAloudBtn.disabled = true;
                }
                lockRecallInput();
                if (recallSayWordBtn) {
                    recallSayWordBtn.disabled = true;
                }
                
                // Start 10 second countdown
                state.runtime.spellingRecall.phase = 'countdown';
                state.runtime.spellingRecall.countdownValue = 10;
                recallCountdownValue.textContent = '10';
                
                state.runtime.spellingRecall.countdownTimer = setInterval(() => {
                    state.runtime.spellingRecall.countdownValue--;
                    recallCountdownValue.textContent = state.runtime.spellingRecall.countdownValue;
                    
                    if (state.runtime.spellingRecall.countdownValue <= 0) {
                        clearInterval(state.runtime.spellingRecall.countdownTimer);
                        state.runtime.spellingRecall.countdownTimer = null;
                        
                        // Transition to typing phase
                        state.runtime.spellingRecall.phase = 'typing';
                        recallControls.dataset.phase = 'typing';
                        recallCountdown.classList.add('hidden');
                        recallInstruction.textContent = DATA.COPY.recallListenPrompt || 'Listen for the next word.';

                        const speechOptions = getSpeechOptions();
                        if (speechOptions.highQuality && isSpeechAvailable(speechOptions)) {
                            const currentWord = getCurrentRecallWord();
                            if (currentWord) {
                                void prepareSpeech(currentWord, speechOptions);
                            }
                        }
                        
                        // Start the timer now
                        state.runtime.startTime = new Date();
                        if (state.runtime.timer && state.runtime.flags.timer && !state.runtime.timer.started) {
                            state.runtime.timer.started = true;
                            if (state.runtime.timer.tick) {
                                state.runtime.timer.handle = setInterval(state.runtime.timer.tick, 1000);
                                state.runtime.timer.tick();
                            }
                        }
                        
                        setTimeout(() => {
                            speakCurrentRecallWord({ unlockOnEnd: true });
                        }, 200);
                    }
                }, 1000);
            });
            
            // Repeat word button
            recallSayWordBtn?.addEventListener('click', () => {
                if (state.runtime.spellingRecall.phase !== 'typing') return;
                const recall = state.runtime.spellingRecall;
                if (!recall) return;
                speakCurrentRecallWord({ unlockOnEnd: recall.inputLocked });
            });
            
            // Override input handler for recall mode
            input.removeEventListener('input', input._recallInputHandler);
            input._recallInputHandler = (e) => {
                const recall = state.runtime.spellingRecall;
                if (!recall || recall.inputLocked) {
                    e.preventDefault();
                    input.value = '';
                    return;
                }
                
                // Update progress bar for recall mode
                const totalWords = recall.shuffledWords.length;
                const completedWords = recall.currentIndex;
                const currentProgress = input.value.length / (recall.shuffledWords[recall.currentIndex]?.length || 1);
                const percent = Math.min(100, ((completedWords + currentProgress * 0.5) / totalWords) * 100);
                progressBar.style.width = `${percent}%`;
            };
            input.addEventListener('input', input._recallInputHandler);
            
            // Submit the current word and move to next
            const submitCurrentWord = () => {
                const recall = state.runtime.spellingRecall;
                if (!recall || recall.inputLocked || recall.phase !== 'typing') return;
                
                const typedWord = input.value.trim();
                const currentWord = getCurrentRecallWord();

                if (state.runtime.flags.lockstep) {
                    const errors = countRecallErrors(currentWord, typedWord);
                    if (errors > 0) {
                        state.runtime.runtimeErrors += errors;
                        input.value = '';
                        input.focus();
                        recallInstruction.textContent = DATA.COPY.recallTryAgain || 'Try again. Press Repeat Word if you want to hear it again.';
                        return;
                    }
                }
                
                // Append word to buffer (with newline separator like spelling tutor)
                // Use the shuffled word order so results match what was spoken
                if (recall.typedBuffer) {
                    recall.typedBuffer += '\n' + typedWord;
                } else {
                    recall.typedBuffer = typedWord;
                }
                
                // Lock input and clear for next word
                lockRecallInput();
                input.value = '';
                recall.currentIndex++;
                
                const speechOptions = getSpeechOptions();
                if (speechOptions.highQuality && isSpeechAvailable(speechOptions)) {
                    const nextWord = getCurrentRecallWord();
                    if (nextWord) {
                        void prepareSpeech(nextWord, speechOptions);
                    }
                }
                
                // Update progress bar
                const totalWords = recall.shuffledWords.length;
                const percent = (recall.currentIndex / totalWords) * 100;
                progressBar.style.width = `${percent}%`;
                
                // Check if done
                if (recall.currentIndex >= recall.shuffledWords.length) {
                    // All words complete
                    recallInstruction.textContent = DATA.COPY.recallComplete || 'All words complete!';
                    if (recallSayWordBtn) {
                        recallSayWordBtn.disabled = true;
                    }
                    
                    // End session with the typed buffer
                    setTimeout(() => {
                        clearDraft();
                        endSession(recall.typedBuffer, state, DATA, showScreen, saveState);
                    }, 500);
                } else {
                    // Ready for next word
                    recallInstruction.textContent = DATA.COPY.recallListenPrompt || 'Listen for the next word.';
                    if (recallSayWordBtn) {
                        recallSayWordBtn.disabled = true;
                    }
                    setTimeout(() => {
                        speakCurrentRecallWord({ unlockOnEnd: true });
                    }, 500);
                }
            };
            
            // Handle Enter key to submit word
            input.removeEventListener('keydown', input._recallKeyHandler);
            input._recallKeyHandler = (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    submitCurrentWord();
                }
            };
            input.addEventListener('keydown', input._recallKeyHandler);
            
            // Cleanup function for recall mode
            state.runtime._cleanupRecallMode = () => {
                if (state.runtime.spellingRecall?.countdownTimer) {
                    clearInterval(state.runtime.spellingRecall.countdownTimer);
                }
                stopSpeaking();
            };
        }
    }
    if (screenName === 'summary') {
        const replayBtn = document.getElementById('replay-btn');
        if (replayBtn) replayBtn.addEventListener('click', () => startSession(state.runtime.lesson, state, showScreen, saveState));
        
        const drillBtn = document.getElementById('start-drill-btn');
        if (drillBtn) drillBtn.addEventListener('click', () => startFocusDrill(state, DATA, showScreen, saveState));
        
        document.getElementById('home-btn').addEventListener('click', () => showScreen('home'));
        
        // Trigger confetti for high accuracy or new personal best
        const results = state.runtime.summaryResults;
        const shouldConfetti = results.accuracy >= 95 || 
            (results.personalBest && (results.netWPM > results.personalBest.netWPM || results.accuracy > results.personalBest.accuracy));
        if (shouldConfetti && !state.settings.reduceMotion) {
            triggerConfetti();
        }
        
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
        const stageFilterGroup = modalContainer.querySelector('.stage-filter-group');
        const stageFilter = modalContainer.querySelector('.stage-filter');
        const searchInput = document.getElementById('search-input');
        const sortSelect = document.getElementById('sort-select');
        const statusFilter = document.getElementById('status-filter');
        const lessonListEl = modalContainer.querySelector('.lesson-list');

        const setStageFilterDisabled = (type) => {
            if (stageFilter) {
                const isPhonics = type === 'phonics';
                stageFilter.classList.toggle('disabled', isPhonics);
                stageFilter.querySelectorAll('.button').forEach(btn => {
                    btn.disabled = isPhonics;
                });
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
            setStageFilterDisabled(newType);
            handleFilterChange({ currentType: newType, currentPage: 1 });
        }));

        stageFilter.querySelectorAll('.button').forEach(b => b.addEventListener('click', (e) => {
            // Get the button element - handle clicks on child elements (like the progress badge)
            const button = e.target.closest('.button[data-stage]');
            if (!button || button.disabled) return;
            
            const clickedStage = button.dataset.stage;
            const currentActive = stageFilter.querySelector('.active');
            // If clicking the already-selected stage, do nothing
            if (currentActive && currentActive.dataset.stage === clickedStage) return;
            currentActive?.classList.remove('active');
            button.classList.add('active');
            handleFilterChange({ currentStage: clickedStage, currentPage: 1 });
        }));

        searchInput.addEventListener('input', debounce(() => {
            handleFilterChange({ searchTerm: searchInput.value, currentPage: 1 });
        }, 300));

        sortSelect.addEventListener('change', () => {
            handleFilterChange({ sortKey: sortSelect.value, currentPage: 1 });
        });

        statusFilter.addEventListener('change', () => {
            handleFilterChange({ statusFilter: statusFilter.value, currentPage: 1 });
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

        // Initial load and render â€“ ensure the default stage data is available
        stageFilter.querySelector(`[data-stage="${state.settings.defaultStage}"]`).classList.add('active');
        const pickerState = getLessonPickerState();
        setStageFilterDisabled(pickerState.currentType);
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
        document.getElementById('setting-sound').checked = s.soundEnabled || false;
        document.getElementById('setting-high-quality-speech').checked = s.highQualitySpeech || false;
        document.getElementById('setting-finger-guide').checked = s.fingerGuide || false;
        document.getElementById('setting-reduce-motion').checked = s.reduceMotion || false;
        document.getElementById('setting-voice-language').value = s.voiceLanguage || 'en-gb';
        document.getElementById('setting-voice-speed').value = s.voiceSpeed ?? 1.0;
        document.getElementById('setting-default-stage').value = s.defaultStage;
        document.getElementById('lh-val').textContent = s.lineHeight;
        document.getElementById('ls-val').textContent = `+${s.letterSpacing}%`;
        document.getElementById('vs-val').textContent = `${Math.round((s.voiceSpeed ?? 1.0) * 100)}%`;

        // Populate voice dropdown
        const voiceSelect = document.getElementById('setting-voice');
        const languageSelect = document.getElementById('setting-voice-language');
        const populateVoices = () => {
            const language = languageSelect.value;
            const voices = getVoices({ language });
            voiceSelect.innerHTML = '';
            
            // Group by gender
            const femaleVoices = voices.filter(v => v.gender === 'female');
            const maleVoices = voices.filter(v => v.gender === 'male');
            
            if (femaleVoices.length) {
                const group = document.createElement('optgroup');
                group.label = 'Female';
                femaleVoices.forEach(v => {
                    const opt = document.createElement('option');
                    opt.value = v.id;
                    opt.textContent = `${v.name} (${v.quality})`;
                    group.appendChild(opt);
                });
                voiceSelect.appendChild(group);
            }
            if (maleVoices.length) {
                const group = document.createElement('optgroup');
                group.label = 'Male';
                maleVoices.forEach(v => {
                    const opt = document.createElement('option');
                    opt.value = v.id;
                    opt.textContent = `${v.name} (${v.quality})`;
                    group.appendChild(opt);
                });
                voiceSelect.appendChild(group);
            }
            
            // Select saved voice if it matches language, otherwise first
            if (s.voice && voices.some(v => v.id === s.voice)) {
                voiceSelect.value = s.voice;
            }
        };
        
        populateVoices();
        languageSelect.addEventListener('change', populateVoices);
        
        // Toggle kokoro-specific settings visibility
        const updateKokoroVisibility = () => {
            const isHighQuality = document.getElementById('setting-high-quality-speech').checked;
            document.querySelectorAll('.kokoro-setting').forEach(el => {
                el.style.display = isHighQuality ? '' : 'none';
            });
        };
        updateKokoroVisibility();
        document.getElementById('setting-high-quality-speech').addEventListener('change', updateKokoroVisibility);

        document.getElementById('setting-line-height').addEventListener('input', e => document.getElementById('lh-val').textContent = e.target.value);
        document.getElementById('setting-letter-spacing').addEventListener('input', e => document.getElementById('ls-val').textContent = `+${e.target.value}%`);
        document.getElementById('setting-voice-speed').addEventListener('input', e => document.getElementById('vs-val').textContent = `${Math.round(e.target.value * 100)}%`);
        
        document.getElementById('save-settings-btn').addEventListener('click', async () => {
            s.theme = document.getElementById('setting-theme').value;
            s.font = document.getElementById('setting-font').value;
            s.lineHeight = document.getElementById('setting-line-height').value;
            s.letterSpacing = document.getElementById('setting-letter-spacing').value;
            s.lockstepDefault = document.getElementById('setting-lockstep').checked;
            s.focusLineDefault = document.getElementById('setting-focusline').checked;
            s.keyboardHintDefault = document.getElementById('setting-keyboard').checked;
            s.showTimerDisplay = document.getElementById('setting-timer-display').checked;
            s.soundEnabled = document.getElementById('setting-sound').checked;
            s.highQualitySpeech = document.getElementById('setting-high-quality-speech').checked;
            s.fingerGuide = document.getElementById('setting-finger-guide').checked;
            s.reduceMotion = document.getElementById('setting-reduce-motion').checked;
            s.voiceLanguage = document.getElementById('setting-voice-language').value;
            s.voice = document.getElementById('setting-voice').value;
            s.voiceSpeed = parseFloat(document.getElementById('setting-voice-speed').value);
            s.defaultStage = document.getElementById('setting-default-stage').value;
            const speechWarmOptions = {
                voice: s.voice,
                language: s.voiceLanguage,
                speed: s.voiceSpeed,
                highQuality: s.highQualitySpeech
            };
            if (s.highQualitySpeech) {
                void initializeKokoro();
            }
            if (s.highQualitySpeech && state.ui.currentScreen === 'typing' && isSpeechAvailable(speechWarmOptions)) {
                const readAloudText = state.runtime.lesson?.mode === 'recall' && state.runtime.recallDisplayText
                    ? state.runtime.recallDisplayText
                    : state.runtime.targetText;
                if (state.runtime.lesson?.mode === 'recall') {
                    const words = state.runtime.spellingRecall?.shuffledWords || [];
                    if (readAloudText) {
                        void prepareSpeech(readAloudText, speechWarmOptions);
                    }
                    if (words.length) {
                        void prepareSpeechBatch(words, speechWarmOptions);
                    }
                } else {
                    void prepareSpeech(readAloudText, speechWarmOptions);
                }
            }
            
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
    if (modalName === 'spellingMode') {
        const stage = state.ui.spellingModeStage || state.settings.defaultStage;
        const stageSpellings = DATA.SPELLING.filter(item => item.stage === stage);
        
        modalContainer.querySelectorAll('[data-spelling-mode]').forEach(btn => {
            btn.addEventListener('click', () => {
                const mode = btn.dataset.spellingMode;
                const lessonData = pickFreshLesson(stageSpellings, 'spelling');
                
                if (!lessonData) {
                    toast(`No fresh spelling lists found for ${stage}. Please try another stage.`);
                    closeModal();
                    return;
                }
                
                closeModal();
                // Start session with the chosen mode
                startSession({ 
                    type: 'spelling', 
                    data: lessonData,
                    mode: mode  // 'tutor' or 'recall'
                }, state, showScreen, saveState);
            });
        });
    }
}

// --- 5. APP INITIALIZATION ---
async function init() {
    const loadingOverlay = document.getElementById('loading-overlay');
    const appContainer = document.getElementById('app-container');

    try {
        await loadInitialData();
        loadState();
        
        // Auto-detect system dark mode preference on first load
        if (!localStorage.getItem('storykeys_state')) {
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            if (prefersDark) {
                state.settings.theme = 'dark';
            }
        }
        
        applySettings(state.settings, state.progress);
        showScreen('home');
        bindAppEvents();

        if (shouldShowWelcome()) {
            showModal('welcome');
        }

        // Pass a reference to the DATA object to a global scope for the pagination controls
        // This is a small workaround to avoid complex event bubbling or state management libraries
        window.StoryKeys = { DATA };

        // Initialize audio keep-alive on first user interaction (prevents audio fade-in on Windows)
        const initAudioOnInteraction = () => {
            initAudioKeepAlive();
            document.removeEventListener('click', initAudioOnInteraction);
            document.removeEventListener('keydown', initAudioOnInteraction);
        };
        document.addEventListener('click', initAudioOnInteraction, { once: true });
        document.addEventListener('keydown', initAudioOnInteraction, { once: true });

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
























