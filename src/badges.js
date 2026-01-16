/**
 * @file badges.js
 * @description Handles the logic for checking and awarding badges based on session performance.
 * 
 * Design principles:
 * - Badges are organized into tracks (practice, accuracy, fluency, time, consistency, variety, courage, specialty, surprise)
 * - Each track has tiers; higher tiers require prior badges (prerequisites)
 * - Per-session limits prevent overwhelming badge dumps
 * - Prioritization ensures the most meaningful badges are awarded first
 * - Hidden (surprise) badges are deprioritized to keep core progress visible
 */

// --- Constants for pacing ---
const MAX_BADGES_PER_SESSION = 3;      // Soft cap: never overwhelm with badges
const MAX_PER_TRACK_PER_SESSION = 1;   // Only one badge per track per session
const FIRST_SESSION_MAX = 2;           // Very first session: extra gentle

/**
 * Checks if a badge's prerequisites are met.
 * @param {object} badge - The badge definition object.
 * @param {Set<string>} earnedIds - Set of already-earned badge IDs.
 * @returns {boolean} True if prerequisites are satisfied.
 */
function prerequisitesMet(badge, earnedIds) {
    if (!badge.requires) return true;
    
    const reqs = Array.isArray(badge.requires) ? badge.requires : [badge.requires];
    return reqs.every(reqId => earnedIds.has(reqId));
}

/**
 * Prioritizes eligible badges to ensure meaningful, paced rewards.
 * Priority order:
 * 1. Lower tier badges first (foundational achievements)
 * 2. Non-hidden badges over hidden (core progress is visible)
 * 3. Higher-impact tracks first (practice > accuracy > variety > others)
 * 4. Alphabetically by ID as tiebreaker
 */
function prioritizeBadges(badges) {
    const trackPriority = {
        practice: 1,    // Core progression
        accuracy: 2,    // Celebrates careful work
        courage: 3,     // Rewards effort
        variety: 4,     // Exploration
        time: 5,        // Cumulative milestones
        consistency: 6, // Return rewards
        fluency: 7,     // Speed (less important for dyslexic learners)
        specialty: 8,   // Niche achievements
        surprise: 9     // Hidden, lowest priority
    };
    
    return badges.sort((a, b) => {
        // Hidden badges always last
        if (a.hidden && !b.hidden) return 1;
        if (!a.hidden && b.hidden) return -1;
        
        // Lower tier first
        if (a.tier !== b.tier) return a.tier - b.tier;
        
        // Track priority
        const aPriority = trackPriority[a.track] || 99;
        const bPriority = trackPriority[b.track] || 99;
        if (aPriority !== bPriority) return aPriority - bPriority;
        
        // Alphabetical tiebreaker
        return a.id.localeCompare(b.id);
    });
}

/**
 * Selects which badges to actually award from eligible candidates.
 * Enforces per-session and per-track limits.
 * @param {object[]} eligible - Array of eligible badge objects.
 * @param {boolean} isFirstSession - Whether this is the user's first session.
 * @returns {object[]} The badges to award this session.
 */
function selectBadgesToAward(eligible, isFirstSession) {
    const maxTotal = isFirstSession ? FIRST_SESSION_MAX : MAX_BADGES_PER_SESSION;
    const selected = [];
    const tracksUsed = new Set();
    
    const prioritized = prioritizeBadges(eligible);
    
    for (const badge of prioritized) {
        if (selected.length >= maxTotal) break;
        
        // Enforce one badge per track per session
        if (tracksUsed.has(badge.track)) continue;
        
        selected.push(badge);
        tracksUsed.add(badge.track);
    }
    
    return selected;
}

/**
 * Main entry point: Checks session results against badge criteria and awards new badges.
 * @param {object} results - The calculated metrics from the completed session.
 * @param {object} state - The main application state object (will be mutated).
 * @param {object} DATA - The global data object (for badge definitions).
 * @returns {string[]} An array of IDs for any newly awarded badges.
 */
export function checkAndAwardBadges(results, state, DATA) {
    const earnedIds = new Set(state.progress.badges.map(b => b.id));
    const hasBadge = (id) => earnedIds.has(id);
    const isFirstSession = state.sessions.length === 0;
    
    // Build session context
    const currentSession = {
        contentType: state.runtime.lesson.type,
        contentId: state.runtime.lesson.data.id,
        stage: state.runtime.lesson.data.stage,
        theme: state.runtime.lesson.data.theme,
        accuracy: results.accuracy,
        errors: results.errors,
        grossWPM: results.grossWPM,
        netWPM: results.netWPM,
        durationSec: results.durationSec,
        charCount: state.runtime.targetTextNorm?.length || 0,
        ts: new Date().toISOString()
    };
    
    const allSessions = [...state.sessions, currentSession];
    const totalLessons = allSessions.length;
    
    // Calculate cumulative stats
    const projectedWordsTotal = state.progress.wordsTotal + (currentSession.charCount / 5);
    const projectedMinutesTotal = state.progress.minutesTotal + (results.durationSec / 60);
    
    // Track themes and stages completed
    const theme = currentSession.theme;
    if (theme) state.progress.themesCompleted[theme] = true;
    const themesCount = Object.keys(state.progress.themesCompleted).length;
    
    const stage = currentSession.stage;
    if (stage) state.progress.stagesCompleted[stage] = true;
    const stagesCount = Object.keys(state.progress.stagesCompleted).length;
    
    // Count sessions by type
    const countByType = (type) => allSessions.filter(s => s.contentType === type).length;
    const passageCount = countByType('passage');
    const spellingCount = countByType('spelling');
    const phonicsCount = countByType('phonics');
    
    // Count high-accuracy sessions
    const highAccuracySessions = allSessions.filter(s => s.accuracy >= 90).length;
    
    // Track unique days practiced
    const uniqueDays = new Set(allSessions.map(s => new Date(s.ts).toDateString()));
    const daysCount = uniqueDays.size;
    
    // Update consecutive days tracking
    const now = new Date();
    const today = now.toDateString();
    if (state.progress.lastPlayed !== today) {
        const yesterday = new Date(now);
        yesterday.setDate(now.getDate() - 1);
        state.progress.lastPlayed === yesterday.toDateString() 
            ? state.progress.consecutiveDays = (state.progress.consecutiveDays || 1) + 1 
            : state.progress.consecutiveDays = 1;
        state.progress.lastPlayed = today;
    }
    const streak = state.progress.consecutiveDays || 1;
    
    // Determine most-used stage for "challenge accepted" badge
    const stageCounts = {};
    allSessions.forEach(s => {
        if (s.stage) stageCounts[s.stage] = (stageCounts[s.stage] || 0) + 1;
    });
    const usualStage = Object.entries(stageCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
    const stageOrder = ['KS1', 'KS2', 'KS3', 'KS4'];
    const isAboveUsual = usualStage && stage && stageOrder.indexOf(stage) > stageOrder.indexOf(usualStage);
    
    // Session-specific flags
    const sessionHour = state.runtime.startTime.getHours();
    const isWeekend = now.getDay() === 0 || now.getDay() === 6;
    const isLockstep = state.runtime.flags?.lockstep;
    const hasPunctuation = state.runtime.lesson.data.tags?.complexity?.punct;
    
    // --- Build eligibility map: badgeId -> true if criteria met ---
    const criteria = {
        // Practice track
        practice_1: totalLessons >= 1,
        practice_5: totalLessons >= 5,
        practice_15: totalLessons >= 15,
        practice_30: totalLessons >= 30,
        practice_50: totalLessons >= 50,
        practice_100: totalLessons >= 100,
        
        // Accuracy track
        accuracy_90: results.accuracy >= 90,
        accuracy_95: results.accuracy >= 95,
        accuracy_98: results.accuracy >= 98,
        accuracy_100: results.accuracy === 100,
        steady_3: highAccuracySessions >= 3,
        steady_10: highAccuracySessions >= 10,
        steady_25: highAccuracySessions >= 25,
        
        // Fluency track
        fluency_20: results.netWPM >= 20,
        fluency_30: results.netWPM >= 30,
        fluency_40: results.netWPM >= 40,
        fluency_50: results.netWPM >= 50,
        fluency_60: results.netWPM >= 60,
        balanced_40: results.netWPM >= 40 && results.accuracy >= 90,
        balanced_50: results.netWPM >= 50 && results.accuracy >= 95,
        
        // Time track
        time_15: projectedMinutesTotal >= 15,
        time_30: projectedMinutesTotal >= 30,
        time_60: projectedMinutesTotal >= 60,
        time_120: projectedMinutesTotal >= 120,
        time_180: projectedMinutesTotal >= 180,
        words_500: projectedWordsTotal >= 500,
        words_1k: projectedWordsTotal >= 1000,
        words_3k: projectedWordsTotal >= 3000,
        words_5k: projectedWordsTotal >= 5000,
        
        // Consistency track
        routine_2: daysCount >= 2,
        routine_5: daysCount >= 5,
        routine_10: daysCount >= 10,
        routine_20: daysCount >= 20,
        streak_3: streak >= 3,
        streak_5: streak >= 5,
        streak_7: streak >= 7,
        
        // Variety track
        explorer_2: themesCount >= 2,
        explorer_4: themesCount >= 4,
        explorer_6: themesCount >= 6,
        mode_passage: passageCount >= 1,
        mode_spelling: spellingCount >= 1,
        mode_phonics: phonicsCount >= 1,
        mode_mixer: passageCount >= 1 && spellingCount >= 1 && phonicsCount >= 1,
        stage_2: stagesCount >= 2,
        stage_3: stagesCount >= 3,
        stage_4: stagesCount >= 4,
        
        // Courage track
        brave_longer: currentSession.charCount >= 200,
        brave_challenging: isAboveUsual,
        brave_steady: results.durationSec >= 300,
        brave_lockstep: results.errors === 0 && isLockstep,
        brave_persist: results.errors >= 10 && totalLessons >= 1,
        
        // Specialty track
        spelling_star: results.errors === 0 && currentSession.contentType === 'spelling',
        spelling_10: spellingCount >= 10,
        spelling_25: spellingCount >= 25,
        phonics_precision: results.accuracy >= 90 && currentSession.contentType === 'phonics',
        phonics_10: phonicsCount >= 10,
        phonics_25: phonicsCount >= 25,
        punct_pro: results.accuracy >= 95 && hasPunctuation,
        
        // Surprise track (hidden badges)
        surprise_early: sessionHour < 9,
        surprise_late: sessionHour >= 21,
        surprise_weekend: isWeekend,
        surprise_streak_10: streak >= 10
    };
    
    // --- Find all eligible badges ---
    const eligible = [];
    
    for (const badge of DATA.BADGES) {
        if (badge._comment) continue;  // Skip comment entries
        
        const id = badge.id;
        
        // Already earned? Skip
        if (hasBadge(id)) continue;
        
        // Criteria not met? Skip
        if (!criteria[id]) continue;
        
        // Prerequisites not met? Skip
        if (!prerequisitesMet(badge, earnedIds)) continue;
        
        eligible.push(badge);
    }
    
    // --- Select which badges to actually award (with pacing) ---
    const toAward = selectBadgesToAward(eligible, isFirstSession);
    const newBadgeIds = toAward.map(b => b.id);
    
    // --- Record awarded badges ---
    if (newBadgeIds.length > 0) {
        const timestamp = new Date().toISOString();
        newBadgeIds.forEach(id => {
            state.progress.badges.push({ id, earnedAt: timestamp });
        });
    }
    
    return newBadgeIds;
}

/**
 * Gets a summary of badge progress for display.
 * @param {object} state - The application state.
 * @param {object} DATA - The global data object.
 * @returns {object} Summary with earned, total, and tracks info.
 */
export function getBadgeProgressSummary(state, DATA) {
    const earnedIds = new Set(state.progress.badges.map(b => b.id));
    const allBadges = DATA.BADGES.filter(b => !b._comment);
    const visibleBadges = allBadges.filter(b => !b.hidden);
    
    const tracks = {};
    for (const badge of allBadges) {
        if (!tracks[badge.track]) {
            tracks[badge.track] = { earned: 0, total: 0, visible: 0 };
        }
        tracks[badge.track].total++;
        if (!badge.hidden) tracks[badge.track].visible++;
        if (earnedIds.has(badge.id)) tracks[badge.track].earned++;
    }
    
    return {
        earned: state.progress.badges.length,
        total: allBadges.length,
        visible: visibleBadges.length,
        tracks
    };
}