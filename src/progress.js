/**
 * @file progress.js
 * @description Helpers for surfacing lesson progress, last visited markers, and completion percentages.
 */

import { normaliseString } from './utils.js';

const clampPercent = (value) => Math.min(100, Math.max(0, Math.round(value)));

/**
 * Builds a stable lesson identifier used across the app.
 * @param {string} type - The lesson type (e.g., passage, spelling, phonics).
 * @param {object} data - The lesson data object that contains id and stage.
 * @returns {string} A composite lesson id.
 */
export function buildLessonId(type, data = {}) {
    const stage = data.stage || 'general';
    const id = data.id || 'unknown';
    const lessonType = type || 'lesson';
    return `${lessonType}:${stage}:${id}`;
}

/**
 * Maps a stored session back to the canonical lesson id.
 * @param {object} session - A session entry from state.sessions.
 * @returns {string} The lesson id.
 */
export function buildLessonIdFromSession(session) {
    return buildLessonId(session.contentType, { id: session.contentId, stage: session.stage });
}

/**
 * Determines if the given lesson matches the last visited marker.
 * @param {object} state - The global state object.
 * @param {string} lessonId - The canonical lesson id.
 * @returns {boolean}
 */
export function isLastLesson(state, lessonId) {
    return Boolean(state?.meta?.lastLessonId) && state.meta.lastLessonId === lessonId;
}

/**
 * Calculates the completion percent for a session based on the longest correct prefix.
 * @param {string} targetTextNorm - The normalized target text for the session.
 * @param {string} finalInput - The final user input string.
 * @returns {number} A percent between 0 and 100.
 */
export function calculateSessionCompletionPercent(targetTextNorm, finalInput) {
    if (!targetTextNorm || targetTextNorm.length === 0) return 0;
    const inputNorm = normaliseString(finalInput || '');
    const limit = Math.min(targetTextNorm.length, inputNorm.length);
    let correctChars = 0;
    for (let i = 0; i < limit; i++) {
        if (inputNorm[i] === targetTextNorm[i]) {
            correctChars = i + 1;
        } else {
            break;
        }
    }
    return clampPercent((correctChars / targetTextNorm.length) * 100);
}

function isLessonMarkedComplete(progress, type, contentId) {
    if (type === 'spelling') return progress.completedSpellings?.includes(contentId);
    if (type === 'phonics') return progress.completedPhonics?.includes(contentId);
    return progress.completedPassages?.includes(contentId);
}

/**
 * Returns the best completion percent achieved for a lesson.
 * @param {object} state - The global state object.
 * @param {string} lessonId - The canonical lesson id.
 * @returns {number} A percent between 0 and 100.
 */
export function getLessonCompletionPercent(state, lessonId) {
    if (!lessonId) return 0;
    const [type, , contentId] = lessonId.split(':');
    let best = 0;

    if (isLessonMarkedComplete(state.progress, type, contentId)) {
        best = 100;
    }

    for (const session of state.sessions) {
        if (buildLessonIdFromSession(session) === lessonId) {
            const completion = typeof session.completionPercent === 'number'
                ? session.completionPercent
                : (session.accuracy === 100 ? 100 : 0);
            best = Math.max(best, clampPercent(completion));
        }
    }

    return best;
}

/**
 * Calculates an average completion percent for a section/stage and lesson type.
 * @param {object} state - The global state object.
 * @param {object} DATA - The global data object.
 * @param {string} type - The lesson type.
 * @param {string} stage - The stage identifier.
 * @returns {number} A percent between 0 and 100.
 */
export function getSectionCompletionPercent(state, DATA, type, stage) {
    const poolMap = {
        passage: DATA.PASSAGES,
        phonics: DATA.PHONICS,
        spelling: DATA.SPELLING,
        wordset: DATA.WORDSETS
    };
    const pool = poolMap[type] || [];
    const lessons = pool.filter(l => !stage || l.stage === stage);
    if (!lessons.length) return 0;

    const total = lessons.reduce((sum, lesson) => sum + getLessonCompletionPercent(state, buildLessonId(type, lesson)), 0);
    return clampPercent(total / lessons.length);
}
