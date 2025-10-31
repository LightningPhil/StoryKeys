/**
 * @file stats.js
 * @description Handles calculation of typing metrics like WPM, accuracy, and errors.
 */

import { normaliseString } from './utils.js';

/**
 * Identifies words that were typed incorrectly.
 * @param {string} targetText - The original text.
 * @param {string} userInput - The user's final input.
 * @returns {string[]} An array of unique tricky words, in lowercase.
 */
function getTrickyWords(targetText, userInput) {
    const t = normaliseString(targetText).split(/\s+/);
    const u = normaliseString(userInput).split(/\s+/);
    const tricky = new Set();
    for (let i = 0; i < t.length; i++) {
        if (t[i] !== (u[i] || '')) {
            tricky.add(t[i].replace(/[.,;:!?'"“”’‘()-]/g, '').toLowerCase());
        }
    }
    return Array.from(tricky);
}

/**
 * Calculates all performance metrics for a completed session.
 * @param {string} finalInput - The final text from the user's input.
 * @param {object} runtime - The runtime state of the session that just ended.
 * @returns {object} An object containing accuracy, duration, errors, WPM, and tricky items.
 */
export function calculateMetrics(finalInput, runtime) {
    const { targetTextNorm, startTime, flags, runtimeErrors, hardestKeys, targetText } = runtime;
    const finalInputNorm = normaliseString(finalInput);
    const durationSec = (new Date() - startTime) / 1000;
    
    // Standard word length is 5 characters, including spaces.
    const wordsTyped = targetTextNorm.length / 5;

    let finalErrors = 0;
    if (flags.lockstep) {
        // In lockstep mode, errors are pre-counted.
        finalErrors = runtimeErrors;
    } else {
        // For standard mode, compare final input to the target.
        for (let i = 0; i < targetTextNorm.length; i++) {
            if (finalInputNorm[i] !== targetTextNorm[i]) {
                finalErrors++;
            }
        }
    }

    const accuracy = Math.max(0, Math.round(100 * (targetTextNorm.length - finalErrors) / targetTextNorm.length));
    const grossWPM = wordsTyped / (durationSec / 60);
    // Net WPM penalizes for uncorrected errors.
    const netWPM = grossWPM - (finalErrors / 5) / (durationSec / 60);

    return {
        accuracy: accuracy,
        durationSec: parseFloat(durationSec.toFixed(1)),
        errors: finalErrors,
        netWPM: Math.max(0, Math.round(netWPM)),
        hardestKeys: Object.entries(hardestKeys).sort(([, a], [, b]) => b - a).slice(0, 3).map(([k]) => k),
        trickyWords: getTrickyWords(targetText, finalInput).slice(0, 3)
    };
}