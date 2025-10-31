/**
 * @file utils.js
 * @description Contains common utility and helper functions for the StoryKeys app.
 */

const PUNCT_NORM = { '’': "'", '‘': "'", '“': '"', '”': '"', '–': '-', '—': '-', '…': '...', '\u00A0': ' ' };

/**
 * Normalizes a single character to its standard equivalent (e.g., smart quotes to straight quotes).
 * @param {string} ch - The character to normalize.
 * @returns {string} The normalized character.
 */
export function normaliseChar(ch) {
    return PUNCT_NORM[ch] ?? ch;
}

/**
 * Normalizes all characters in a string.
 * @param {string} s - The string to normalize.
 * @returns {string} The normalized string.
 */
export function normaliseString(s) {
    return s.split('').map(normaliseChar).join('');
}

/**
 * Trims a string and collapses multiple whitespace characters into a single space.
 * @param {string} text - The text to transform.
 * @returns {string} The transformed text.
 */
export function transformText(text) {
    return text.replace(/\s+/g, ' ').trim();
}

/**
 * Generates a SHA-256 hash of a string. Used for the parent PIN.
 * @param {string} s - The string to hash.
 * @returns {Promise<string>} A promise that resolves to the hex-encoded hash.
 */
export async function sha256Hex(s) {
    const buf = new TextEncoder().encode(s);
    const hash = await crypto.subtle.digest('SHA-256', buf);
    return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Trims a raw user input string so its normalized length matches a given limit.
 * This is crucial for handling multi-character symbols correctly at the end of a session.
 * @param {string} raw - The raw input string.
 * @param {number} normLimit - The maximum length the normalized string should have.
 * @returns {string} The trimmed raw string.
 */
export function rawTrimToNormLen(raw, normLimit) {
    let acc = 0, out = '';
    for (const ch of raw) {
        acc += normaliseChar(ch).length;
        if (acc > normLimit) break;
        out += ch;
    }
    return out;
}

/**
 * Creates a debounced function that delays invoking `func` until after `wait` milliseconds
 * have elapsed since the last time the debounced function was invoked.
 * @param {function} func - The function to debounce.
 * @param {number} wait - The number of milliseconds to delay.
 * @returns {function} The new debounced function.
 */
export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}