import type { AppData, AppState, CompletedListKey, LessonData, LessonType, Progress, SessionRecord } from '../types';
import { normaliseString } from '../utils';

const clampPercent = (value: number): number => Math.min(100, Math.max(0, Math.round(value)));

export function buildLessonId(type: string, data: Partial<LessonData> = {}): string {
  const stage = ('stage' in data && data.stage) ? data.stage : 'general';
  const id = ('id' in data && data.id) ? data.id : 'unknown';
  const lessonType = type || 'lesson';
  return `${lessonType}:${stage}:${id}`;
}

export function buildLessonIdFromSession(session: SessionRecord): string {
  return buildLessonId(session.contentType, { id: session.contentId, stage: session.stage });
}

export function isLastLesson(state: AppState, lessonId: string): boolean {
  return Boolean(state.meta.lastLessonId) && state.meta.lastLessonId === lessonId;
}

export function calculateSessionCompletionPercent(targetTextNorm: string, finalInput: string): number {
  if (!targetTextNorm || targetTextNorm.length === 0) return 0;
  const inputNorm = normaliseString(finalInput || '');
  const limit = Math.min(targetTextNorm.length, inputNorm.length);
  let correctChars = 0;
  for (let i = 0; i < limit; i++) {
    if (inputNorm[i] === targetTextNorm[i]) {
      correctChars = i + 1;
    } else {
      break;
    }
  }
  return clampPercent((correctChars / targetTextNorm.length) * 100);
}

export function updateStreak(state: AppState): void {
  const today = new Date().toDateString();
  const lastPlayed = state.progress.lastPlayed;

  if (!lastPlayed) {
    state.progress.consecutiveDays = 1;
  } else if (lastPlayed !== today) {
    const lastDate = new Date(lastPlayed);
    const todayDate = new Date(today);
    const diffDays = Math.round((todayDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
      state.progress.consecutiveDays = (state.progress.consecutiveDays || 0) + 1;
    } else {
      state.progress.consecutiveDays = 1;
    }
  }

  state.progress.lastPlayed = today;
}

function isLessonMarkedComplete(progress: Progress, type: string, contentId: string): boolean {
  if (type === 'spelling') return progress.completedSpellings.includes(contentId);
  if (type === 'phonics') return progress.completedPhonics.includes(contentId);
  if (type === 'wordset') return progress.completedWordsets.includes(contentId);
  return progress.completedPassages.includes(contentId);
}

export function getCompletedListKey(type: LessonType | string): CompletedListKey | null {
  if (type === 'passage') return 'completedPassages';
  if (type === 'phonics') return 'completedPhonics';
  if (type === 'spelling') return 'completedSpellings';
  if (type === 'wordset') return 'completedWordsets';
  return null;
}

export function getLessonCompletionPercent(state: AppState, lessonId: string): number {
  if (!lessonId) return 0;
  const [type, , contentId] = lessonId.split(':');
  let best = 0;

  if (type && contentId && isLessonMarkedComplete(state.progress, type, contentId)) {
    best = 100;
  }

  for (const session of state.sessions) {
    if (buildLessonIdFromSession(session) === lessonId) {
      const completion = typeof session.completionPercent === 'number'
        ? session.completionPercent
        : (session.accuracy === 100 ? 100 : 0);
      best = Math.max(best, clampPercent(completion));
    }
  }

  return best;
}

export function getSectionCompletionPercent(
  state: AppState,
  data: AppData,
  type: LessonType | string,
  stage: string,
): number {
  const poolMap = {
    passage: data.PASSAGES,
    phonics: data.PHONICS,
    spelling: data.SPELLING,
    wordset: data.WORDSETS,
  } as const;
  const pool = poolMap[type as keyof typeof poolMap] || [];
  const lessons = pool.filter((lesson) => !stage || lesson.stage === stage);
  if (!lessons.length) return 0;

  const total = lessons.reduce(
    (sum, lesson) => sum + getLessonCompletionPercent(state, buildLessonId(type, lesson)),
    0,
  );
  return clampPercent(total / lessons.length);
}
