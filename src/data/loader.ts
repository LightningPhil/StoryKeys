import type {
  AppData,
  BadgeDefinition,
  ContentId,
  CopyData,
  DrillData,
  Lesson,
  LessonData,
  LessonType,
  Passage,
  PatternPack,
  Wordset,
} from '../types';
import { isStage, STAGES } from '../types';

const STAGE_DATA_TYPES = ['passages', 'wordsets', 'patterns'] as const;
const DATA_PATH = 'data/';

const loadedStages = new Set<string>();
const loadingStages = new Map<string, Promise<boolean>>();

const POOL_BY_TYPE: Record<LessonType, keyof AppData> = {
  passage: 'PASSAGES',
  phonics: 'PHONICS',
  spelling: 'SPELLING',
  wordset: 'WORDSETS',
  drill: 'PASSAGES',
};

const emptyCopy: CopyData = {
  homeChangeLesson: 'Choose something to type',
  lockstepOn: 'Lockstep',
  focusLineOn: 'Focus Line',
  metricAccuracy: 'Accuracy',
  metricWPM: 'Words per minute',
  metricTime: 'Time',
  metricErrors: 'Errors',
  summaryNiceWork: 'Lovely typing!',
  summaryReplay: 'Try again',
  summaryHome: 'Home',
  summaryDrill: 'Start Focus Drill',
  summaryHardestKeys: 'Hardest keys',
  summaryTrickyWords: 'Tricky words',
  pasteBlocked: 'Typing practice works best without pasting.',
  encourageGentle: ['Nice and steady.'],
};

export const DATA: AppData = {
  PASSAGES: [],
  WORDSETS: [],
  PATTERNS: [],
  PHONICS: [],
  SPELLING: [],
  BADGES: [],
  COPY: { ...emptyCopy },
};

async function fetchJSON<T>(url: string): Promise<T | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.warn(`Failed to load data from ${url}. Status: ${response.status}`);
      return null;
    }
    return await response.json() as T;
  } catch (error) {
    console.warn(`Network error or invalid JSON at ${url}:`, error);
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export async function loadInitialData(): Promise<boolean> {
  const [badges, copy, phonics, spelling] = await Promise.all([
    fetchJSON<BadgeDefinition[]>(`${DATA_PATH}badges.json`),
    fetchJSON<CopyData>(`${DATA_PATH}copy.json`),
    fetchJSON<Passage[]>(`${DATA_PATH}phonics.json`),
    fetchJSON<Wordset[]>(`${DATA_PATH}spelling.json`),
  ]);

  if (!copy) {
    throw new Error('Core data (copy.json) failed to load. The application cannot start.');
  }

  DATA.BADGES = badges || [];
  DATA.COPY = { ...emptyCopy, ...copy };
  DATA.PHONICS = phonics || [];
  DATA.SPELLING = spelling || [];

  return true;
}

export async function loadStageData(stage: string): Promise<boolean> {
  if (loadedStages.has(stage) || !STAGES.includes(stage as typeof STAGES[number])) {
    return true;
  }
  const inFlight = loadingStages.get(stage);
  if (inFlight) {
    return inFlight;
  }

  const loadPromise = (async () => {
    const [passages, wordsets, patterns] = await Promise.all(
      STAGE_DATA_TYPES.map((type) => fetchJSON<unknown[]>(`${DATA_PATH}${stage}/${type}.json`)),
    );

    if (Array.isArray(passages)) DATA.PASSAGES.push(...(passages as Passage[]));
    if (Array.isArray(wordsets)) DATA.WORDSETS.push(...(wordsets as Wordset[]));
    if (Array.isArray(patterns)) DATA.PATTERNS.push(...(patterns as PatternPack[]));

    loadedStages.add(stage);
    return true;
  })();

  loadingStages.set(stage, loadPromise);
  try {
    return await loadPromise;
  } finally {
    loadingStages.delete(stage);
  }
}

function isLessonLike(item: unknown): item is LessonData {
  return isRecord(item) && typeof item.id === 'string';
}

const LESSON_POOLS = ['PASSAGES', 'WORDSETS', 'PHONICS', 'SPELLING'] as const;

export function createLesson(type: LessonType, data: LessonData, withTimer?: boolean): Lesson | null {
  switch (type) {
    case 'passage':
    case 'phonics':
      return 'text' in data && typeof data.text === 'string'
        ? { type, data: data as Passage, withTimer }
        : null;
    case 'spelling':
    case 'wordset':
      return 'words' in data && Array.isArray(data.words)
        ? { type, data: data as Wordset, withTimer }
        : null;
    case 'drill':
      return ('words' in data && Array.isArray(data.words)) || ('text' in data && typeof data.text === 'string')
        ? { type, data: data as DrillData, withTimer }
        : null;
  }
}

export function findLesson(type: LessonType | string, id: ContentId): LessonData | null {
  const key = POOL_BY_TYPE[type as LessonType] || 'PASSAGES';
  if (!LESSON_POOLS.includes(key as typeof LESSON_POOLS[number])) return null;
  const pool = DATA[key as typeof LESSON_POOLS[number]];
  const match = pool.find((item) => isLessonLike(item) && item.id === id);
  return match ?? null;
}

export async function ensureLessonLoaded(
  type: LessonType | string,
  id: ContentId,
  stage?: string,
): Promise<LessonData | null> {
  if (type === 'spelling' || type === 'phonics') {
    return findLesson(type, id);
  }
  const found = findLesson(type, id);
  if (found) return found;
  const stagesToTry = isStage(stage) ? [stage] : [...STAGES];
  for (const s of stagesToTry) {
    await loadStageData(s);
    const match = findLesson(type, id);
    if (match) return match;
  }
  return null;
}
