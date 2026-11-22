import type {
  AppData,
  AppState,
  CompletedListKey,
  ContentId,
  LessonData,
  LessonKey,
  LessonType,
  Progress,
  SessionRecord,
} from '../types';
import { isLessonType } from '../types';
import { normaliseString } from '../utils';

const clampPercent = (value: number): number => Math.min(100, Math.max(0, Math.round(value)));

export function buildLessonKey(type: LessonType, data: Partial<LessonData> = {}): LessonKey {
  const stage = ('stage' in data && data.stage) ? data.stage : 'general';
  const id = ('id' in data && data.id) ? data.id : 'unknown';
  return `${type}:${stage}:${id}`;
}

export function buildLessonKeyFromSession(session: SessionRecord): LessonKey {
  return buildLessonKey(session.contentType, { id: session.contentId, stage: session.stage });
}

export function isLastLesson(state: AppState, lessonKey: LessonKey): boolean {
  return Boolean(state.meta.lastLessonId) && state.meta.lastLessonId === lessonKey;
}

export function calculateSessionCompletionPercent(targetTextNorm: string, finalInput: string): number {
  if (!targetTextNorm || targetTextNorm.length === 0) return 0;
  const inputNorm = normaliseString(finalInput || '');
  const typedLen = Math.min(targetTextNorm.length, inputNorm.length);
  return clampPercent((typedLen / targetTextNorm.length) * 100);
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

function isLessonMarkedComplete(progress: Progress, type: LessonType, contentId: ContentId): boolean {
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

export function getLessonCompletionPercent(state: AppState, lessonKey: LessonKey): number {
  if (!lessonKey) return 0;
  const [rawType, , contentId] = lessonKey.split(':');
  let best = 0;

  if (isLessonType(rawType) && contentId && isLessonMarkedComplete(state.progress, rawType, contentId)) {
    best = 100;
  }

  for (const session of state.sessions) {
    if (buildLessonKeyFromSession(session) === lessonKey) {
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
  type: LessonType,
  stage: string,
): number {
  const poolMap = {
    passage: data.PASSAGES,
    phonics: data.PHONICS,
    spelling: data.SPELLING,
    wordset: data.WORDSETS,
    drill: data.PASSAGES,
  } as const;
  const pool = poolMap[type] || [];
  const lessons = pool.filter((lesson) => !stage || lesson.stage === stage);
  if (!lessons.length) return 0;

  const total = lessons.reduce(
    (sum, lesson) => sum + getLessonCompletionPercent(state, buildLessonKey(type, lesson)),
    0,
  );
  return clampPercent(total / lessons.length);
}
