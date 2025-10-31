/**
 * @file badges.js
 * @description Handles the logic for checking and awarding badges based on session performance.
 */

/**
 * Checks session results against badge criteria and awards new badges.
 * @param {object} results - The calculated metrics from the completed session.
 * @param {object} state - The main application state object (will be mutated).
 * @param {object} DATA - The global data object (for badge definitions).
 * @returns {string[]} An array of IDs for any newly awarded badges.
 */
export function checkAndAwardBadges(results, state, DATA) {
    const newBadges = [];
    const hasBadge = (id) => state.progress.badges.some(b => b.id === id);
    
    // Helper to award a badge if it hasn't been earned already.
    const award = (id) => {
        if (!hasBadge(id)) {
            newBadges.push(id);
        }
    };

    const sessionHour = state.runtime.startTime.getHours();

    // --- Accuracy Badges ---
    if (results.accuracy >= 98) award('accuracy_ace_98');
    if (results.accuracy === 100) award('perfectionist_100');
    // Check previous sessions for the 'Steady 95' badge.
    if (state.sessions.filter(s => s.accuracy >= 95).length >= 2 && results.accuracy >= 95) award('steady_95');
    if (results.errors === 0 && state.runtime.flags.lockstep) award('calm_careful');
    if (results.accuracy >= 95 && state.runtime.lesson.data.tags?.complexity?.punct) award('punct_pro');

    // --- Variety Badges ---
    const theme = state.runtime.lesson.data.theme;
    if (theme) state.progress.themesCompleted[theme] = true;
    if (Object.keys(state.progress.themesCompleted).length >= 3) award('explorer');
    if (state.progress.themesCompleted['Animals'] && state.progress.themesCompleted['Nature'] && state.progress.themesCompleted['Science snips']) award('genre_hopper');

    const stage = state.runtime.lesson.data.stage;
    if (stage) state.progress.stagesCompleted[stage] = true;
    if (state.progress.stagesCompleted['KS1'] && state.progress.stagesCompleted['KS2'] && state.progress.stagesCompleted['KS3']) award('stage_scholar');

    // --- Consistency Badges ---
    const now = new Date();
    const today = now.toDateString();
    if (state.progress.lastPlayed !== today) {
        const yesterday = new Date(now);
        yesterday.setDate(now.getDate() - 1);
        state.progress.consecutiveDays = state.progress.lastPlayed === yesterday.toDateString() ? (state.progress.consecutiveDays || 1) + 1 : 1;
        state.progress.lastPlayed = today;
    }
    if (state.progress.consecutiveDays >= 3) award('routine');
    if (state.progress.consecutiveDays >= 5) award('five_day_streak');

    // --- Time-based Badges ---
    if (sessionHour < 9) award('early_bird');
    if (sessionHour >= 21) award('night_owl');

    // --- Milestone Badges ---
    if (state.progress.wordsTotal >= 1000) award('word_wizard_1k');
    if (state.progress.minutesTotal >= 30) award('typing_titan_30');
    if (state.progress.minutesTotal >= 60) award('marathoner_60');

    // If new badges were awarded, add them to the user's progress state.
    if (newBadges.length > 0) {
        newBadges.forEach(id => {
            state.progress.badges.push({ id, earnedAt: new Date().toISOString() });
        });
    }

    return newBadges;
}