/**
 * @file dataLoader.js
 * @description Fetches and consolidates all external JSON data for the StoryKeys app.
 */

// Define the structure of the data files to be loaded.
const STAGES = ['KS1', 'KS2', 'KS3', 'KS4'];
const STAGE_DATA_TYPES = ['passages', 'wordsets', 'patterns'];
const GLOBAL_FILES = ['badges', 'copy', 'keymap'];
// This path has been corrected to be relative to the root index.html
const DATA_PATH = 'data/';

/**
 * The main data object that will be populated and exported for the app to use.
 */
export const DATA = {
    PASSAGES: [],
    WORDSETS: [],
    PATTERNS: [],
    BADGES: [],
    KEYMAP: [],
    COPY: {},
};

/**
 * Fetches a single JSON file from a given URL.
 * @param {string} url - The URL of the JSON file to fetch.
 * @returns {Promise<object|null>} A promise that resolves to the parsed JSON data, or null on failure.
 */
async function fetchJSON(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            // Log a warning but don't throw, allowing the app to proceed with partial data if possible.
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
 * Loads all required JSON data for the application.
 * It fetches global files and all stage-specific files concurrently.
 * @returns {Promise<boolean>} A promise that resolves to true on success or throws an error on critical failure.
 */
export async function loadAllData() {
    const promises = [];
    const promiseMap = new Map();

    // Create fetch promises for all global files
    for (const file of GLOBAL_FILES) {
        const url = `${DATA_PATH}${file}.json`;
        const promise = fetchJSON(url);
        promises.push(promise);
        promiseMap.set(file, promise);
    }

    // Create fetch promises for all stage-specific files
    for (const stage of STAGES) {
        for (const type of STAGE_DATA_TYPES) {
            const url = `${DATA_PATH}${stage}/${type}.json`;
            const key = `${stage}_${type}`; // e.g., "KS1_passages"
            const promise = fetchJSON(url);
            promises.push(promise);
            promiseMap.set(key, promise);
        }
    }

    // Wait for all fetch operations to complete
    await Promise.all(promises);

    // Populate the global DATA object from the resolved promises
    DATA.BADGES = await promiseMap.get('badges') || [];
    DATA.COPY = await promiseMap.get('copy') || {};
    DATA.KEYMAP = await promiseMap.get('keymap') || [];

    // Consolidate all stage-specific data into single arrays
    for (const stage of STAGES) {
        const passages = await promiseMap.get(`${stage}_passages`);
        if (passages) DATA.PASSAGES.push(...passages);

        const wordsets = await promiseMap.get(`${stage}_wordsets`);
        if (wordsets) DATA.WORDSETS.push(...wordsets);

        const patterns = await promiseMap.get(`${stage}_patterns`);
        if (patterns) DATA.PATTERNS.push(...patterns);
    }

    // Basic validation to ensure the app can run
    if (DATA.PASSAGES.length === 0 || !DATA.COPY.appTitle) {
        throw new Error("Core data (passages or copy) failed to load. The application cannot start.");
    }

    console.log("All data loaded and consolidated successfully.");
    return true;
}