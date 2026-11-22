import { playSuccessSound } from '../audio/sounds';
import { loadStageData } from '../data/loader';
import { awardBadges, evaluateEligibleBadges } from '../progress/badges';
import { buildLessonKey, calculateSessionCompletionPercent, getCompletedListKey, updateStreak } from '../progress/progress';
import type {
  AppData,
  AppState,
  CompletedListKey,
  Lesson,
  LessonData,
  LessonType,
  PersistStateFn,
  ShowScreenFn,
  StartSessionOptions,
} from '../types';
import { isStage } from '../types';
import { toast } from '../ui/feedback';
import { getLessonTitle, normaliseString, prepareTargetText, rawTrimToNormLen } from '../utils';
import { calculateMetrics } from './stats';

export function teardownRuntime(runtime: AppState['runtime'] | undefined): void {
  if (!runtime) return;
  if (runtime.timer?.handle) {
    clearInterval(runtime.timer.handle);
    runtime.timer.handle = null;
  }
  if (runtime.wpmSampleInterval) {
    clearInterval(runtime.wpmSampleInterval);
    runtime.wpmSampleInterval = null;
  }
  runtime.abortController?.abort();
  runtime.abortController = null;
}

export function pickFreshLesson<T extends LessonData>(
  pool: T[],
  type: LessonType,
  state: Pick<AppState, 'progress' | 'sessions'>,
): T | null {
  const completedByType: Record<LessonType, CompletedListKey> = {
    spelling: 'completedSpellings',
    phonics: 'completedPhonics',
    wordset: 'completedWordsets',
    passage: 'completedPassages',
    drill: 'completedPassages',
  };
  const completedIds = new Set(state.progress[completedByType[type]]);
  const unseen = pool.filter((item) => item.id && !completedIds.has(item.id));
  if (unseen.length) {
    return unseen[Math.floor(Math.random() * unseen.length)] ?? null;
  }

  const history = state.sessions.filter((s) => s.contentType === type);
  if (!history.length) {
    return pool.length ? pool[Math.floor(Math.random() * pool.length)] ?? null : null;
  }

  const lastPlayed = new Map<string, number>();
  history.forEach((s) => lastPlayed.set(s.contentId, new Date(s.ts).getTime()));
  return [...pool].sort((a, b) => (lastPlayed.get(a.id ?? '') || 0) - (lastPlayed.get(b.id ?? '') || 0))[0] || null;
}

function resolveSourceText(lesson: Lesson): string {
  switch (lesson.type) {
    case 'passage':
    case 'phonics':
      return lesson.data.text;
    case 'spelling':
      return lesson.data.words.join('\n');
    case 'wordset':
      return lesson.data.words.join(' ');
    case 'drill':
      return lesson.data.text ? lesson.data.text : lesson.data.words.join(' ');
  }
}

export function startSession(
  lesson: Lesson,
  state: AppState,
  showScreen: ShowScreenFn,
  persistState?: PersistStateFn,
  options: StartSessionOptions = {},
): void {
  if (!lesson?.data) return;
  const isDrill = lesson.type === 'drill';
  const isSpelling = lesson.type === 'spelling';
  const sourceText = resolveSourceText(lesson);
  if (!sourceText) {
    toast('This lesson has no text to type.');
    return;
  }
  teardownRuntime(state.runtime);
  const targetText = prepareTargetText(sourceText, isSpelling);
  const targetTextNorm = normaliseString(targetText);
  const initialInput = options.resumedTypedText
    ? rawTrimToNormLen(options.resumedTypedText, Math.max(0, targetTextNorm.length - 1))
    : '';
  const baselineChars = normaliseString(initialInput).length;

  const lessonKey = buildLessonKey(lesson.type, lesson.data);
  state.meta.lastLessonId = lessonKey;
  persistState?.();

  const timerCountdown = isDrill || Boolean(lesson.withTimer);
  const showTimerChip = state.settings.showTimerDisplay;
  state.runtime = {
    lesson,
    targetText,
    targetTextNorm,
    initialInput,
    baselineChars,
    startTime: new Date(),
    runtimeErrors: 0,
    hardestKeys: {},
    flags: {
      lockstep: state.settings.lockstepDefault,
      focusLine: state.settings.focusLineDefault,
      keyboardHint: state.settings.keyboardHintDefault,
      timer: true,
      countdownTimer: timerCountdown,
      showTimerChip,
      punct: lesson.data.tags?.complexity?.punct ?? true,
    },
    isDrill,
    timer: {
      handle: null,
      paused: false,
      manualPaused: false,
      autoPaused: false,
      remaining: 60,
      started: false,
      startedAtMs: null,
      accumulatedMs: 0,
    },
    lineElements: [],
    vanishedLines: new Set(),
  };
  showScreen('typing');
}

export function endSession(
  finalInput: string,
  state: AppState,
  data: AppData,
  showScreen: ShowScreenFn,
  persistState: PersistStateFn,
): void {
  if (!state.runtime.targetTextNorm) return;
  if (state.runtime.timer?.handle) {
    clearInterval(state.runtime.timer.handle);
    state.runtime.timer.handle = null;
  }

  const results = calculateMetrics(finalInput, state.runtime);
  const finalInputNorm = normaliseString(finalInput);
  const baselineChars = Math.min(state.runtime.baselineChars ?? 0, finalInputNorm.length);
  const newlyTypedChars = Math.max(0, finalInputNorm.length - baselineChars);
  const completionPercent = calculateSessionCompletionPercent(state.runtime.targetTextNorm, finalInput);

  updateStreak(state);
  state.progress.wordsTotal += newlyTypedChars / 5;
  state.progress.minutesTotal += results.durationSec / 60;

  const sessionId = `sess_${Date.now()}`;
  const lesson = state.runtime.lesson;
  const contentId = lesson?.data.id;
  const lessonType = lesson?.type;

  if (!state.runtime.isDrill && lesson && contentId && lessonType) {
    if (lesson.data.theme) state.progress.themesCompleted[lesson.data.theme] = true;
    if (lesson.data.stage) state.progress.stagesCompleted[lesson.data.stage] = true;

    const listName = getCompletedListKey(lessonType);
    if (listName && completionPercent === 100) {
      if (!state.progress[listName].includes(contentId)) {
        state.progress[listName].push(contentId);
      }
    }

    state.sessions.push({
      id: sessionId,
      ts: new Date().toISOString(),
      contentId,
      contentType: lessonType,
      title: getLessonTitle(lesson.data),
      stage: lesson.data.stage,
      completionPercent,
      ...results,
      flags: state.runtime.flags ?? {
        lockstep: false,
        focusLine: false,
        keyboardHint: false,
        timer: false,
        countdownTimer: false,
        showTimerChip: false,
        punct: true,
      },
    });
    if (state.sessions.length > 500) state.sessions.shift();
  }

  const newBadges = evaluateEligibleBadges(results, state, data);
  awardBadges(state, newBadges);

  const previousSessions = contentId
    ? state.sessions.filter((s) => s.contentId === contentId && s.id !== sessionId)
    : [];
  let personalBest: { netWPM: number; accuracy: number } | null = null;
  if (previousSessions.length > 0) {
    personalBest = {
      netWPM: Math.max(...previousSessions.map((s) => s.netWPM || 0)),
      accuracy: Math.max(...previousSessions.map((s) => s.accuracy || 0)),
    };
  }

  playSuccessSound(state.settings.soundEnabled);
  state.runtime.summaryResults = {
    ...results,
    newBadges,
    isDrill: Boolean(state.runtime.isDrill),
    personalBest,
  };

  persistState();
  showScreen('summary');
}

export async function startFocusDrill(
  state: AppState,
  data: AppData,
  showScreen: ShowScreenFn,
  persistState?: PersistStateFn,
): Promise<void> {
  const { trickyWords = [], hardestKeys = [] } = state.runtime.summaryResults || {};
  const lessonStage = state.runtime.lesson?.data.stage;
  const stageToEnsure = isStage(lessonStage) ? lessonStage : state.settings.defaultStage;
  await loadStageData(stageToEnsure);

  let drillLesson: Lesson | null = null;

  if (trickyWords.length > 0) {
    const lessonTags = state.runtime.lesson?.data.tags?.phonics ?? [];
    const tagsForWord = (word: string): string[] => {
      const collected = new Set<string>(lessonTags);
      for (const ws of data.WORDSETS) {
        if (ws.tags?.phonics?.length && ws.words?.includes(word)) {
          ws.tags.phonics.forEach((t) => collected.add(t));
        }
      }
      for (const p of data.PASSAGES) {
        if (p.tags?.phonics?.length && p.text && p.text.toLowerCase().split(/\W+/).includes(word)) {
          p.tags.phonics.forEach((t) => collected.add(t));
        }
      }
      for (const ph of data.PHONICS) {
        if (ph.tags?.phonics?.length && ph.text && ph.text.toLowerCase().split(/\W+/).includes(word)) {
          ph.tags.phonics.forEach((t) => collected.add(t));
        }
      }
      return Array.from(collected);
    };
    const patterns = new Map<string, string[]>();
    for (const tw of trickyWords) {
      for (const tag of tagsForWord(tw)) {
        const pack = data.PATTERNS.find((pp) =>
          pp.tags?.phonics?.some((pt) => pt === tag || pt.startsWith(`${tag}_`)),
        );
        if (pack && pack.items?.length) patterns.set(pack.name, pack.items);
      }
    }
    const firstPattern = patterns.entries().next().value;
    if (firstPattern) {
      const [name, items] = firstPattern;
      drillLesson = { type: 'drill', data: { name: `Focus on: ${name}`, words: items }, withTimer: true };
    }
  }

  if (!drillLesson && trickyWords.length > 0) {
    drillLesson = {
      type: 'drill',
      data: { name: 'Focus on: Tricky Words', words: [...trickyWords, ...trickyWords] },
      withTimer: true,
    };
  } else if (!drillLesson && hardestKeys.length > 0) {
    const key = hardestKeys[0] ?? '';
    const words = [...data.WORDSETS, ...data.PASSAGES, ...data.PHONICS]
      .flatMap((d) => {
        if ('words' in d && d.words) return d.words;
        if ('text' in d && d.text) return d.text.split(' ');
        return [];
      })
      .filter((w) => normaliseString(w).toLowerCase().includes(key));
    const drillWords = [...new Set(words)].filter((w) => w.length > 2).sort(() => 0.5 - Math.random()).slice(0, 10);
    if (drillWords.length > 4) {
      drillLesson = { type: 'drill', data: { name: `Focus on: '${key}' key`, words: drillWords }, withTimer: true };
    }
  }

  if (drillLesson) {
    startSession(drillLesson, state, showScreen, persistState);
  } else {
    toast('No specific drill available for that session.');
  }
}
