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

    const currentSession = {
        contentType: state.runtime.lesson.type,
        contentId: state.runtime.lesson.data.id,
        stage: state.runtime.lesson.data.stage,
        accuracy: results.accuracy,
        errors: results.errors,
        grossWPM: results.grossWPM,
        netWPM: results.netWPM,
        durationSec: results.durationSec,
        ts: new Date().toISOString()
    };

    const allSessions = [...state.sessions, currentSession];

    // Helper to award a badge if it hasn't been earned already.
    const award = (id) => {
        if (!hasBadge(id)) {
            newBadges.push(id);
        }
    };

    const sessionHour = state.runtime.startTime.getHours();

    const getStageForSession = (session) => session.stage
        || DATA.PASSAGES.find(p => p.id === session.contentId)?.stage
        || DATA.SPELLING.find(s => s.id === session.contentId)?.stage
        || DATA.PHONICS.find(p => p.id === session.contentId)?.stage;

    const countSessions = (filterFn) => allSessions.filter(filterFn).length;
    const countByType = (type, stage) => countSessions(s => s.contentType === type && (!stage || getStageForSession(s) === stage));

    const projectedWordsTotal = state.progress.wordsTotal + (state.runtime.targetTextNorm?.length || 0) / 5;
    const projectedMinutesTotal = state.progress.minutesTotal + (results.durationSec / 60);

    // --- Stage-specific badges ---
    const STAGES = ['KS1', 'KS2', 'KS3', 'KS4'];
    const thresholds = [1, 3, 5, 10, 15];

    STAGES.forEach(stage => {
        thresholds.forEach(threshold => {
            if (countByType('passage', stage) >= threshold) award(`passage_${stage.toLowerCase()}_${threshold}`);
            if (countByType('spelling', stage) >= threshold) award(`spelling_${stage.toLowerCase()}_${threshold}`);
        });
    });

    const phonicsThresholds = [1, 3, 5, 8, 12];
    phonicsThresholds.forEach(threshold => {
        if (countByType('phonics') >= threshold) award(`phonics_${threshold}`);
    });

    // --- Accuracy Badges ---
    if (results.accuracy >= 98) award('accuracy_ace_98');
    if (results.accuracy === 100) award('perfectionist_100');
    if (countSessions(s => s.accuracy >= 95) >= 3) award('steady_95');
    if (results.errors === 0 && state.runtime.flags.lockstep) award('calm_careful');
    if (results.accuracy >= 95 && state.runtime.lesson.data.tags?.complexity?.punct) award('punct_pro');
    if (results.errors === 0 && state.runtime.lesson.type === 'spelling') award('spelling_star');
    if (results.accuracy >= 90 && state.runtime.lesson.type === 'phonics') award('phonic_precision');

    // --- Variety Badges ---
    const theme = state.runtime.lesson.data.theme;
    if (theme) state.progress.themesCompleted[theme] = true;
    if (Object.keys(state.progress.themesCompleted).length >= 3) award('explorer');
    if (state.progress.themesCompleted['Animals'] && state.progress.themesCompleted['Nature'] && state.progress.themesCompleted['Science snips']) award('genre_hopper');

    const stage = state.runtime.lesson.data.stage;
    if (stage) state.progress.stagesCompleted[stage] = true;
    if (state.progress.stagesCompleted['KS1'] && state.progress.stagesCompleted['KS2'] && state.progress.stagesCompleted['KS3']) award('stage_scholar');
    if (state.progress.stagesCompleted['KS1'] && state.progress.stagesCompleted['KS2'] && state.progress.stagesCompleted['KS3'] && state.progress.stagesCompleted['KS4']) award('stage_master');
    if (countByType('passage') && countByType('spelling') && countByType('phonics')) award('mode_mixer');

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
    if (now.getDay() === 0 || now.getDay() === 6) award('weekend_warrior');
    if (results.durationSec >= 300) award('steady_reader');

    // --- Milestone Badges ---
    if (projectedWordsTotal >= 1000) award('word_wizard_1k');
    if (projectedWordsTotal >= 5000) award('word_wizard_5k');
    if (projectedMinutesTotal >= 30) award('typing_titan_30');
    if (projectedMinutesTotal >= 60) award('marathoner_60');
    if (projectedMinutesTotal >= 180) award('endurance_hero');

    // --- Speed Badges ---
    if (results.netWPM >= 40) award('speedy_40');
    if (results.netWPM >= 60) award('speedy_60');
    if (results.grossWPM >= 70 && results.accuracy >= 95) award('balanced_blaze');

    // If new badges were awarded, add them to the user's progress state.
    if (newBadges.length > 0) {
        newBadges.forEach(id => {
            state.progress.badges.push({ id, earnedAt: new Date().toISOString() });
        });
    }

    return newBadges;
}