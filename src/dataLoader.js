/**
 * @file dataLoader.js
 * @description Fetches and consolidates all external JSON data for the StoryKeys app.
 * Implements lazy-loading for stage-specific data.
 */

const STAGES = ['KS1', 'KS2', 'KS3', 'KS4'];
const STAGE_DATA_TYPES = ['passages', 'wordsets', 'patterns'];
const GLOBAL_FILES = ['badges', 'copy', 'keymap'];
const PHONICS_FILE = 'phonics';
const SPELLING_FILE = 'spelling';
const DATA_PATH = 'data/';

// This Set will keep track of which stage's data has been fetched.
const loadedStages = new Set();

export const DATA = {
    PASSAGES: [],
    WORDSETS: [],
    PATTERNS: [],
    PHONICS: [],
    SPELLING: [],
    BADGES: [],
    KEYMAP: [],
    COPY: {},
};

async function fetchJSON(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            console.warn(`Failed to load data from ${url}. Status: ${response.status}`);
            return null;
        }
        return await response.json();
    } catch (error) {
        console.warn(`Network error or invalid JSON at ${url}:`, error);
        return null;
    }
}

/**
 * Loads the initial global data required for the app to start.
 * @returns {Promise<boolean>}
 */
export async function loadInitialData() {
    const promises = GLOBAL_FILES.map(file => fetchJSON(`${DATA_PATH}${file}.json`));
    const [badges, copy, keymap, phonics, spelling] = await Promise.all([
        ...promises,
        fetchJSON(`${DATA_PATH}${PHONICS_FILE}.json`),
        fetchJSON(`${DATA_PATH}${SPELLING_FILE}.json`)
    ]);

    DATA.BADGES = badges || [];
    DATA.COPY = copy || {};
    DATA.KEYMAP = keymap || [];
    DATA.PHONICS = phonics || [];
    DATA.SPELLING = spelling || [];

    if (!DATA.COPY.appTitle) {
        throw new Error("Core data (copy.json) failed to load. The application cannot start.");
    }
    console.log("Initial global data loaded.");
    return true;
}

/**
 * Loads data for a specific Key Stage if it hasn't been loaded yet.
 * @param {string} stage - The stage to load (e.g., "KS1", "KS2").
 * @returns {Promise<boolean>} Resolves to true if data is loaded or was already present.
 */
export async function loadStageData(stage) {
    if (loadedStages.has(stage) || !STAGES.includes(stage)) {
        return true; // Already loaded or invalid stage, resolve immediately.
    }

    console.log(`Fetching data for stage: ${stage}...`);
    const promises = STAGE_DATA_TYPES.map(type => fetchJSON(`${DATA_PATH}${stage}/${type}.json`));
    const [passages, wordsets, patterns] = await Promise.all(promises);

    if (passages) DATA.PASSAGES.push(...passages);
    if (wordsets) DATA.WORDSETS.push(...wordsets);
    if (patterns) DATA.PATTERNS.push(...patterns);

    loadedStages.add(stage);
    console.log(`Stage ${stage} data loaded and consolidated.`);
    return true;
}