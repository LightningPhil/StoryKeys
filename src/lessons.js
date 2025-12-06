/**
 * @file lessons.js
 * @description Manages the lifecycle of typing lessons, including starting, ending, and creating drills.
 */

import { calculateMetrics } from './stats.js';
import { checkAndAwardBadges } from './badges.js';
import { toast } from './ui.js';
import { normaliseString, transformText } from './utils.js';

/**
 * Starts a new typing session.
 * @param {object} lesson - The lesson object to start.
 * @param {object} state - The main application state object (will be mutated).
 * @param {function} showScreen - Callback to render a new screen.
 */
export function startSession(lesson, state, showScreen) {
    if (!lesson || !lesson.data) return;
    const isDrill = lesson.type === 'drill';
    const sourceText = lesson.data.text || lesson.data.words.join(' ');
    const targetText = transformText(sourceText);

    const timerCountdown = isDrill || lesson.withTimer;
    const showTimerChip = state.settings.showTimerDisplay;
    state.runtime = {
        lesson,
        targetText,
        targetTextNorm: normaliseString(targetText),
        startTime: new Date(),
        runtimeErrors: 0,
        hardestKeys: {},
        flags: {
            lockstep: state.settings.lockstepDefault,
            focusLine: state.settings.focusLineDefault,
            keyboardHint: state.settings.keyboardHintDefault,
            timer: timerCountdown || showTimerChip,
            countdownTimer: timerCountdown,
            showTimerChip,
            punct: lesson.data.tags?.complexity?.punct ?? true
        },
        isDrill,
        timer: {
            handle: null,
            paused: false,
            remaining: 60
        },
        lineElements: [],
    };
    showScreen('typing');
}

/**
 * Ends the current typing session, calculates results, and shows the summary.
 * @param {string} finalInput - The final text from the user's input.
 * @param {object} state - The main application state object (will be mutated).
 * @param {object} DATA - The global data object.
 * @param {function} showScreen - Callback to render a new screen.
 * @param {function} saveState - Callback to save the application state to localStorage.
 */
export function endSession(finalInput, state, DATA, showScreen, saveState) {
    if (state.runtime.timer.handle) clearInterval(state.runtime.timer.handle);

    const results = calculateMetrics(finalInput, state.runtime, state.sessions);
    const newBadges = checkAndAwardBadges(results, state, DATA);

    state.progress.wordsTotal += state.runtime.targetTextNorm.length / 5;
    state.progress.minutesTotal += results.durationSec / 60;

    // --- NEW: Record completed passage ---
    if ((state.runtime.lesson.type === 'passage' || state.runtime.lesson.type === 'phonics') && !state.runtime.isDrill) {
        const lessonId = state.runtime.lesson.data.id;
        // Ensure the completedPassages array exists
        if (!state.progress.completedPassages) {
            state.progress.completedPassages = [];
        }
        // Add the ID only if it's not already there
        if (!state.progress.completedPassages.includes(lessonId)) {
            state.progress.completedPassages.push(lessonId);
        }
    }
    // --- END NEW ---

    if (!state.runtime.isDrill) {
        state.sessions.push({
            id: `sess_${Date.now()}`,
            ts: new Date().toISOString(),
            contentId: state.runtime.lesson.data.id,
            contentType: state.runtime.lesson.type,
            ...results,
            flags: state.runtime.flags
        });
        if (state.sessions.length > 500) state.sessions.shift();
    }

    state.runtime.summaryResults = { ...results, newBadges, isDrill: state.runtime.isDrill };
    
    saveState();
    showScreen('summary');
}

/**
 * Creates and starts a new focus drill based on the results of the last session.
 * @param {object} state - The main application state object.
 * @param {object} DATA - The global data object.
 * @param {function} showScreen - Callback to render a new screen.
 */
export function startFocusDrill(state, DATA, showScreen) {
    const { trickyWords, hardestKeys } = state.runtime.summaryResults;
    let drillLesson = null;

    if (trickyWords.length > 0) {
        const tagsForWord = (word) => {
            for (const ws of DATA.WORDSETS) if (ws.words?.includes(word)) return ws.tags?.phonics || [];
            for (const p of DATA.PASSAGES) if (p.text && p.text.toLowerCase().split(/\W+/).includes(word)) return p.tags?.phonics || [];
            for (const ph of DATA.PHONICS) if (ph.text && ph.text.toLowerCase().split(/\W+/).includes(word)) return ph.tags?.phonics || [];
            return [];
        };
        const patterns = new Map();
        for (const tw of trickyWords) {
            for (const tag of tagsForWord(tw)) {
                const pack = DATA.PATTERNS.find(pp => pp.tags?.phonics?.includes(tag));
                if (pack) patterns.set(pack.name, pack.items);
            }
        }
        if (patterns.size) {
            const [name, items] = patterns.entries().next().value;
            drillLesson = { type: 'drill', data: { name: `Focus on: ${name}`, words: items }, withTimer: true };
        }
    }

    if (!drillLesson && trickyWords.length > 0) {
        drillLesson = { type: 'drill', data: { name: "Focus on: Tricky Words", words: [...trickyWords, ...trickyWords] }, withTimer: true };
    } else if (!drillLesson && hardestKeys.length > 0) {
        const key = hardestKeys[0];
        const words = [...DATA.WORDSETS, ...DATA.PASSAGES, ...DATA.PHONICS].flatMap(d => d.words || d.text.split(' ')).filter(w => normaliseString(w).toLowerCase().includes(key));
        const drillWords = [...new Set(words)].filter(w => w.length > 2).sort(() => 0.5 - Math.random()).slice(0, 10);
        if (drillWords.length > 4) {
            drillLesson = { type: 'drill', data: { name: `Focus on: '${key}' key`, words: drillWords }, withTimer: true };
        }
    }

    if (drillLesson) {
        startSession(drillLesson, state, showScreen);
    } else {
        toast("No specific drill available for that session.");
    }
}