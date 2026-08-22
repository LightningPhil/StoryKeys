import type { Draft, LessonData, LessonType } from './types';
import { isLessonType } from './types';

export const STATE_KEY = 'storykeys_state';
export const DRAFT_KEY = 'storykeys_draft';
const DRAFT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export function saveDraft(
  lessonId: string,
  lessonType: LessonType,
  typedText: string,
  lessonData: LessonData,
): void {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({
      lessonId,
      lessonType,
      typedText,
      lessonData,
      savedAt: Date.now(),
    }));
  } catch (e) {
    console.warn('Unable to save draft:', e);
  }
}

function isDraft(value: unknown): value is Draft {
  if (!value || typeof value !== 'object') return false;
  const draft = value as Partial<Draft>;
  return (
    typeof draft.lessonId === 'string' &&
    isLessonType(draft.lessonType) &&
    typeof draft.typedText === 'string' &&
    typeof draft.savedAt === 'number' &&
    Boolean(draft.lessonData) &&
    typeof draft.lessonData === 'object'
  );
}

export function loadDraft(): Draft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isDraft(parsed)) {
      clearDraft();
      return null;
    }
    if (Date.now() - parsed.savedAt > DRAFT_MAX_AGE_MS) {
      clearDraft();
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearDraft(): void {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch (e) {
    console.warn('Unable to clear draft:', e);
  }
}

export function clearAllStoredData(): void {
  try {
    localStorage.removeItem(STATE_KEY);
    localStorage.removeItem(DRAFT_KEY);
  } catch (e) {
    console.warn('Unable to clear stored data:', e);
  }
}
