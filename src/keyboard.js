/**
 * @file keyboard.js
 * @description Manages user input, typing display updates, and the on-screen keyboard.
 */

import { normaliseChar, normaliseString, rawTrimToNormLen } from './utils.js';

/**
 * The main event handler for the typing input textarea.
 * @param {Event} e - The input event.
 * @param {object} state - The main application state.
 * @param {object} DATA - The global data object.
 * @param {function} endSession - Callback function to end the session.
 */
export function handleTypingInput(e, state, DATA, endSession) {
    if (!state.runtime || !state.runtime.targetTextNorm) return;
    
    updateTypingDisplay(e.target.value, state, DATA);
    
    // Check if the lesson is complete.
    if (normaliseString(e.target.value).length >= state.runtime.targetTextNorm.length) {
        e.target.disabled = true;
        const finalInput = rawTrimToNormLen(e.target.value, state.runtime.targetTextNorm.length);
        // Use a short timeout to allow the final character to render correctly.
        setTimeout(() => endSession(finalInput), 100);
    }
}

/**
 * Updates the typing target display based on user input.
 * @param {string} userInput - The current value from the textarea.
 * @param {object} state - The main application state.
 * @param {object} DATA - The global data object.
 */
export function updateTypingDisplay(userInput, state, DATA) {
    const { targetTextNorm, flags, hardestKeys, lineElements } = state.runtime;
    const targetEl = document.getElementById('typing-target');
    if (!targetEl) return;
    const userInputNorm = normaliseString(userInput);

    // --- Lockstep Mode Logic ---
    if (flags.lockstep && userInputNorm.length > 0 && userInputNorm.slice(-1) !== targetTextNorm[userInputNorm.length - 1]) {
        const inputEl = document.getElementById('typing-input');
        inputEl.value = userInput.slice(0, -1); // Revert the incorrect input.
        state.runtime.runtimeErrors++;
        const key = targetTextNorm[userInputNorm.length - 1];
        if (key && key !== ' ') hardestKeys[key] = (hardestKeys[key] || 0) + 1;
        
        // Visual feedback for the error.
        inputEl.style.borderColor = '#ef4444';
        setTimeout(() => { inputEl.style.borderColor = '' }, 200);
        return; // Stop further processing for this incorrect input.
    }
    
    // --- Error Tracking for Standard Mode ---
    if (!flags.lockstep && userInputNorm.length > 0) {
        const lastIndex = userInputNorm.length - 1;
        if (userInputNorm[lastIndex] !== targetTextNorm[lastIndex]) {
            const key = targetTextNorm[lastIndex];
            if (key && key !== ' ') hardestKeys[key] = (hardestKeys[key] || 0) + 1;
        }
    }

    const nextIdx = userInputNorm.length;

    // --- Current Line Highlighting ---
    if (lineElements && lineElements.length > 0) {
        lineElements.forEach(el => el.classList.remove('current-line'));
        let currentLine = null;
        if (nextIdx < targetTextNorm.length) {
            const nextCharEl = targetEl.querySelector(`.char[data-idx="${nextIdx}"]`);
            if (nextCharEl) currentLine = nextCharEl.parentElement;
        } else if (lineElements.length > 0) {
            currentLine = lineElements[lineElements.length - 1];
        }
        if (currentLine) currentLine.classList.add('current-line');
    }

    // --- Character Class Updates ---
    const chars = Array.from(targetEl.querySelectorAll('.char'));
    chars.forEach((span) => {
        const i = parseInt(span.dataset.idx);
        span.className = 'char'; // Reset classes
        if (i < userInputNorm.length) {
            span.classList.add(userInputNorm[i] === targetTextNorm[i] ? 'correct' : 'incorrect');
        }
        if (i === nextIdx) {
            span.classList.add('current');
        }
    });

    // --- Next Key Bubble & Keyboard Hint ---
    const nextKey = nextIdx < targetTextNorm.length ? targetTextNorm[nextIdx] : null;
    const bubble = document.getElementById('next-key-bubble');
    if (nextKey && bubble) {
        const keyInfo = DATA.KEYMAP.find(k => k.key === nextKey.toLowerCase());
        const keyName = (keyInfo && keyInfo.name) ? keyInfo.name : nextKey;
        const prettyName = keyName === ' ' ? DATA.COPY.spaceName : keyName;

        bubble.innerHTML = `${prettyName} <small style="opacity:.7">${keyInfo ? `– ${keyInfo.hand} ${keyInfo.finger}` : ''}</small>`;
        
        if (flags.keyboardHint) {
            const keyboardEl = document.getElementById('keyboard-hint');
            const currentHighlight = keyboardEl.querySelector('.key.highlight');
            if (currentHighlight) currentHighlight.classList.remove('highlight');
            
            const nextKeyEl = keyboardEl.querySelector(`.key[data-key="${nextKey.toLowerCase()}"]`);
            if (nextKeyEl) nextKeyEl.classList.add('highlight');
        }
    } else if (bubble) {
        bubble.innerHTML = '🎉';
    }
}

/**
 * Calculates the visual line breaks of the target text within its container.
 * This is essential for the "focus line" feature to work correctly.
 * @param {object} state - The main application state.
 * @param {object} DATA - The global data object.
 */
export function calculateVisualLines(state, DATA) {
    const container = document.getElementById('typing-target');
    if (!container) return;

    // First, unwrap any existing .line divs to allow the browser to reflow naturally.
    const existingLines = Array.from(container.querySelectorAll('.line'));
    if (existingLines.length) {
        const frag = document.createDocumentFragment();
        existingLines.forEach(line => {
            const charsInLine = Array.from(line.querySelectorAll('.char'));
            charsInLine.forEach(ch => frag.appendChild(ch));
        });
        container.innerHTML = '';
        container.appendChild(frag);
    }

    // Defer the measurement to the next frame to ensure layout is complete.
    requestAnimationFrame(() => {
        const chars = Array.from(container.querySelectorAll('.char'));
        if (!chars.length) return;

        // Group characters into lines based on their vertical position.
        const groups = [];
        let lastTop = null;
        chars.forEach(ch => {
            const top = ch.offsetTop;
            if (lastTop === null || top !== lastTop) {
                groups.push([]);
                lastTop = top;
            }
            groups[groups.length - 1].push(ch);
        });

        // Wrap each group of characters in a .line div.
        const frag2 = document.createDocumentFragment();
        const lineEls = [];
        groups.forEach(group => {
            const div = document.createElement('div');
            div.className = 'line';
            group.forEach(ch => div.appendChild(ch));
            frag2.appendChild(div);
            lineEls.push(div);
        });

        container.innerHTML = '';
        container.appendChild(frag2);
        state.runtime.lineElements = lineEls;

        // Re-apply highlights and current character state after rebuilding the DOM.
        const inputEl = document.getElementById('typing-input');
        updateTypingDisplay(inputEl ? inputEl.value : '', state, DATA);
    });
}