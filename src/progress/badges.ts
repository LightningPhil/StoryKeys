import type { AppData, AppState, BadgeDefinition, SessionMetrics } from '../types';

const MAX_BADGES_PER_SESSION = 3;
const MAX_PER_TRACK_PER_SESSION = 1;
const FIRST_SESSION_MAX = 2;

const TRACK_PRIORITY: Record<string, number> = {
  practice: 1,
  accuracy: 2,
  courage: 3,
  variety: 4,
  time: 5,
  consistency: 6,
  fluency: 7,
  specialty: 8,
  surprise: 9,
};

function prerequisitesMet(badge: BadgeDefinition, earnedIds: Set<string>): boolean {
  if (!badge.requires) return true;
  const reqs = Array.isArray(badge.requires) ? badge.requires : [badge.requires];
  return reqs.every((reqId) => earnedIds.has(reqId));
}

function prioritizeBadges(badges: BadgeDefinition[]): BadgeDefinition[] {
  return [...badges].sort((a, b) => {
    if (a.hidden && !b.hidden) return 1;
    if (!a.hidden && b.hidden) return -1;

    const aTier = a.tier ?? 99;
    const bTier = b.tier ?? 99;
    if (aTier !== bTier) return aTier - bTier;

    const aPriority = TRACK_PRIORITY[a.track ?? ''] ?? 99;
    const bPriority = TRACK_PRIORITY[b.track ?? ''] ?? 99;
    if (aPriority !== bPriority) return aPriority - bPriority;

    return (a.id ?? '').localeCompare(b.id ?? '');
  });
}

function selectBadgesToAward(eligible: BadgeDefinition[], isFirstSession: boolean): BadgeDefinition[] {
  const maxTotal = isFirstSession ? FIRST_SESSION_MAX : MAX_BADGES_PER_SESSION;
  const selected: BadgeDefinition[] = [];
  const tracksUsed = new Set<string>();

  for (const badge of prioritizeBadges(eligible)) {
    if (selected.length >= maxTotal) break;
    if (badge.track && tracksUsed.has(badge.track) && selected.length >= MAX_PER_TRACK_PER_SESSION) {
      continue;
    }
    if (badge.track && tracksUsed.has(badge.track)) continue;
    selected.push(badge);
    if (badge.track) tracksUsed.add(badge.track);
  }

  return selected;
}

/**
 * Pure badge eligibility evaluator. Reads already-updated `state.progress` and
 * `state.sessions` without mutating `state`.
 */
export function evaluateEligibleBadges(
  results: SessionMetrics,
  state: AppState,
  data: AppData,
): string[] {
  const earnedIds = new Set(state.progress.badges.map((b) => b.id));
  const hasBadge = (id: string) => earnedIds.has(id);
  const lesson = state.runtime.lesson;
  const currentType = lesson?.type ?? 'passage';
  const currentStage = lesson?.data.stage;

  const allSessions = state.sessions;
  const totalLessons = allSessions.length;
  const isFirstSession = totalLessons <= 1;

  const charCount = state.runtime.targetTextNorm?.length || 0;
  const wordsTotal = state.progress.wordsTotal;
  const minutesTotal = state.progress.minutesTotal;
  const themesCount = Object.keys(state.progress.themesCompleted).length;
  const stagesCount = Object.keys(state.progress.stagesCompleted).length;

  const countByType = (type: string) => allSessions.filter((s) => s.contentType === type).length;
  const passageCount = countByType('passage');
  const spellingCount = countByType('spelling');
  const phonicsCount = countByType('phonics');
  const highAccuracySessions = allSessions.filter((s) => s.accuracy >= 90).length;
  const uniqueDays = new Set(allSessions.map((s) => new Date(s.ts).toDateString()));
  const daysCount = uniqueDays.size;
  const streak = state.progress.consecutiveDays || 1;

  const stageCounts: Record<string, number> = {};
  allSessions.forEach((s) => {
    if (s.stage) stageCounts[s.stage] = (stageCounts[s.stage] || 0) + 1;
  });
  const usualStage = Object.entries(stageCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
  const stageOrder = ['KS1', 'KS2', 'KS3', 'KS4'];
  const isAboveUsual = Boolean(
    usualStage && currentStage && stageOrder.indexOf(currentStage) > stageOrder.indexOf(usualStage),
  );

  const sessionStart = state.runtime.startTime ?? new Date();
  const sessionHour = sessionStart.getHours();
  const isWeekend = sessionStart.getDay() === 0 || sessionStart.getDay() === 6;
  const isLockstep = state.runtime.flags?.lockstep;
  const hasPunctuation = lesson?.data.tags?.complexity?.punct;

  const criteria: Record<string, boolean> = {
    practice_1: totalLessons >= 1,
    practice_5: totalLessons >= 5,
    practice_15: totalLessons >= 15,
    practice_30: totalLessons >= 30,
    practice_50: totalLessons >= 50,
    practice_100: totalLessons >= 100,
    accuracy_90: results.accuracy >= 90,
    accuracy_95: results.accuracy >= 95,
    accuracy_98: results.accuracy >= 98,
    accuracy_100: results.accuracy === 100,
    steady_3: highAccuracySessions >= 3,
    steady_10: highAccuracySessions >= 10,
    steady_25: highAccuracySessions >= 25,
    fluency_20: results.netWPM >= 20,
    fluency_30: results.netWPM >= 30,
    fluency_40: results.netWPM >= 40,
    fluency_50: results.netWPM >= 50,
    fluency_60: results.netWPM >= 60,
    balanced_40: results.netWPM >= 40 && results.accuracy >= 90,
    balanced_50: results.netWPM >= 50 && results.accuracy >= 95,
    time_15: minutesTotal >= 15,
    time_30: minutesTotal >= 30,
    time_60: minutesTotal >= 60,
    time_120: minutesTotal >= 120,
    time_180: minutesTotal >= 180,
    words_500: wordsTotal >= 500,
    words_1k: wordsTotal >= 1000,
    words_3k: wordsTotal >= 3000,
    words_5k: wordsTotal >= 5000,
    routine_2: daysCount >= 2,
    routine_5: daysCount >= 5,
    routine_10: daysCount >= 10,
    routine_20: daysCount >= 20,
    streak_3: streak >= 3,
    streak_5: streak >= 5,
    streak_7: streak >= 7,
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
    brave_longer: charCount >= 200,
    brave_challenging: isAboveUsual,
    brave_steady: results.durationSec >= 300,
    brave_lockstep: results.errors === 0 && Boolean(isLockstep),
    brave_persist: results.errors >= 10 && totalLessons >= 1,
    spelling_star: results.errors === 0 && currentType === 'spelling',
    spelling_10: spellingCount >= 10,
    spelling_25: spellingCount >= 25,
    phonics_precision: results.accuracy >= 90 && currentType === 'phonics',
    phonics_10: phonicsCount >= 10,
    phonics_25: phonicsCount >= 25,
    punct_pro: results.accuracy >= 95 && Boolean(hasPunctuation),
    surprise_early: sessionHour < 9,
    surprise_late: sessionHour >= 21,
    surprise_weekend: isWeekend,
    surprise_streak_10: streak >= 10,
  };

  const eligible: BadgeDefinition[] = [];
  for (const badge of data.BADGES) {
    if (!badge.id) continue;
    if (hasBadge(badge.id)) continue;
    if (!criteria[badge.id]) continue;
    if (!prerequisitesMet(badge, earnedIds)) continue;
    eligible.push(badge);
  }

  const toAward = selectBadgesToAward(eligible, isFirstSession);
  return toAward.map((b) => b.id).filter((id): id is string => Boolean(id));
}

export function awardBadges(state: AppState, badgeIds: string[], earnedAt = new Date().toISOString()): void {
  if (!badgeIds.length) return;
  for (const id of badgeIds) {
    state.progress.badges.push({ id, earnedAt });
  }
}
