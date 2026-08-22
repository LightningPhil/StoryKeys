import type { AppData, AppState, BadgeDefinition, BadgeProgressSummary, SessionMetrics, SessionRecord } from '../types';

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

export function checkAndAwardBadges(results: SessionMetrics, state: AppState, data: AppData): string[] {
  const earnedIds = new Set(state.progress.badges.map((b) => b.id));
  const hasBadge = (id: string) => earnedIds.has(id);
  const isFirstSession = state.sessions.length === 0;
  const lesson = state.runtime.lesson;

  const currentSession: SessionRecord = {
    id: 'pending',
    contentType: lesson?.type ?? 'passage',
    contentId: (lesson?.data && 'id' in lesson.data && lesson.data.id) ? lesson.data.id : '',
    stage: lesson?.data && 'stage' in lesson.data ? lesson.data.stage : undefined,
    title: '',
    accuracy: results.accuracy,
    errors: results.errors,
    grossWPM: results.grossWPM,
    netWPM: results.netWPM,
    durationSec: results.durationSec,
    completionPercent: 0,
    hardestKeys: results.hardestKeys,
    trickyWords: results.trickyWords,
    flags: state.runtime.flags ?? {
      lockstep: false,
      focusLine: false,
      keyboardHint: false,
      timer: false,
      countdownTimer: false,
      showTimerChip: false,
      punct: true,
    },
    ts: new Date().toISOString(),
  };

  const charCount = state.runtime.targetTextNorm?.length || 0;
  const allSessions = [...state.sessions, currentSession];
  const totalLessons = allSessions.length;

  const projectedWordsTotal = state.progress.wordsTotal + (charCount / 5);
  const projectedMinutesTotal = state.progress.minutesTotal + (results.durationSec / 60);

  const theme = lesson?.data && 'theme' in lesson.data ? lesson.data.theme : undefined;
  if (theme) state.progress.themesCompleted[theme] = true;
  const themesCount = Object.keys(state.progress.themesCompleted).length;

  const stage = currentSession.stage;
  if (stage) state.progress.stagesCompleted[stage] = true;
  const stagesCount = Object.keys(state.progress.stagesCompleted).length;

  const countByType = (type: string) => allSessions.filter((s) => s.contentType === type).length;
  const passageCount = countByType('passage');
  const spellingCount = countByType('spelling');
  const phonicsCount = countByType('phonics');
  const highAccuracySessions = allSessions.filter((s) => s.accuracy >= 90).length;
  const uniqueDays = new Set(allSessions.map((s) => new Date(s.ts).toDateString()));
  const daysCount = uniqueDays.size;
  const now = new Date();
  const streak = state.progress.consecutiveDays || 1;

  const stageCounts: Record<string, number> = {};
  allSessions.forEach((s) => {
    if (s.stage) stageCounts[s.stage] = (stageCounts[s.stage] || 0) + 1;
  });
  const usualStage = Object.entries(stageCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
  const stageOrder = ['KS1', 'KS2', 'KS3', 'KS4'];
  const isAboveUsual = Boolean(
    usualStage && stage && stageOrder.indexOf(stage) > stageOrder.indexOf(usualStage),
  );

  const sessionHour = (state.runtime.startTime ?? new Date()).getHours();
  const isWeekend = now.getDay() === 0 || now.getDay() === 6;
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
    time_15: projectedMinutesTotal >= 15,
    time_30: projectedMinutesTotal >= 30,
    time_60: projectedMinutesTotal >= 60,
    time_120: projectedMinutesTotal >= 120,
    time_180: projectedMinutesTotal >= 180,
    words_500: projectedWordsTotal >= 500,
    words_1k: projectedWordsTotal >= 1000,
    words_3k: projectedWordsTotal >= 3000,
    words_5k: projectedWordsTotal >= 5000,
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
    spelling_star: results.errors === 0 && currentSession.contentType === 'spelling',
    spelling_10: spellingCount >= 10,
    spelling_25: spellingCount >= 25,
    phonics_precision: results.accuracy >= 90 && currentSession.contentType === 'phonics',
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
    if (badge._comment || !badge.id) continue;
    if (hasBadge(badge.id)) continue;
    if (!criteria[badge.id]) continue;
    if (!prerequisitesMet(badge, earnedIds)) continue;
    eligible.push(badge);
  }

  const toAward = selectBadgesToAward(eligible, isFirstSession);
  const newBadgeIds = toAward.map((b) => b.id).filter((id): id is string => Boolean(id));

  if (newBadgeIds.length > 0) {
    const timestamp = new Date().toISOString();
    newBadgeIds.forEach((id) => {
      state.progress.badges.push({ id, earnedAt: timestamp });
    });
  }

  return newBadgeIds;
}

export function getBadgeProgressSummary(state: AppState, data: AppData): BadgeProgressSummary {
  const earnedIds = new Set(state.progress.badges.map((b) => b.id));
  const allBadges = data.BADGES.filter((b) => !b._comment);
  const visibleBadges = allBadges.filter((b) => !b.hidden);
  const tracks: Record<string, { earned: number; total: number; visible: number }> = {};

  for (const badge of allBadges) {
    const track = badge.track ?? 'other';
    if (!tracks[track]) {
      tracks[track] = { earned: 0, total: 0, visible: 0 };
    }
    tracks[track].total++;
    if (!badge.hidden) tracks[track].visible++;
    if (badge.id && earnedIds.has(badge.id)) tracks[track].earned++;
  }

  return {
    earned: state.progress.badges.length,
    total: allBadges.length,
    visible: visibleBadges.length,
    tracks,
  };
}
