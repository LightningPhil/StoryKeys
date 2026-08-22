import { playSuccessSound } from '../audio/sounds';
import { checkAndAwardBadges } from '../progress/badges';
import { buildLessonId, calculateSessionCompletionPercent, getCompletedListKey, updateStreak } from '../progress/progress';
import type { AppData, AppState, Lesson, PersistStateFn, ShowScreenFn } from '../types';
import { toast } from '../ui/feedback';
import { getLessonTitle, normaliseString, transformText } from '../utils';
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
  runtime._cleanupPauseHandler?.();
  runtime._cleanupResize?.();
  runtime._cleanupSummaryKeys?.();
  runtime._cleanupPauseHandler = null;
  runtime._cleanupResize = null;
  runtime._cleanupSummaryKeys = null;
}

export function startSession(
  lesson: Lesson,
  state: AppState,
  showScreen: ShowScreenFn,
  persistState?: PersistStateFn,
): void {
  if (!lesson?.data) return;
  const isDrill = lesson.type === 'drill';
  const isSpelling = lesson.type === 'spelling';
  const words = 'words' in lesson.data && lesson.data.words ? lesson.data.words : [];
  const sourceText = ('text' in lesson.data && lesson.data.text)
    ? lesson.data.text
    : (isSpelling ? words.join('\n') : words.join(' '));
  if (!sourceText) {
    toast('This lesson has no text to type.');
    return;
  }
  teardownRuntime(state.runtime);
  const targetText = isSpelling ? sourceText : transformText(sourceText);

  const lessonId = buildLessonId(lesson.type, lesson.data);
  if (lessonId) {
    state.meta.lastLessonId = lessonId;
    persistState?.();
  }

  const timerCountdown = isDrill || Boolean(lesson.withTimer);
  const showTimerChip = state.settings.showTimerDisplay;
  state.runtime = {
    lesson,
    targetText,
    targetTextNorm: normaliseString(targetText),
    startTime: new Date(),
    runtimeErrors: 0,
    hardestKeys: {},
    flags: {
      lockstep: state.settings.lockstepDefault,
      focusLine: state.settings.focusLineDefault,
      keyboardHint: state.settings.keyboardHintDefault,
      timer: timerCountdown || showTimerChip,
      countdownTimer: timerCountdown,
      showTimerChip,
      punct: lesson.data.tags?.complexity?.punct ?? true,
    },
    isDrill,
    timer: {
      handle: null,
      paused: false,
      remaining: 60,
      started: false,
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
  if (state.runtime.timer?.handle) clearInterval(state.runtime.timer.handle);

  const results = calculateMetrics(finalInput, state.runtime);
  updateStreak(state);
  const newBadges = checkAndAwardBadges(results, state, data);

  state.progress.wordsTotal += state.runtime.targetTextNorm.length / 5;
  state.progress.minutesTotal += results.durationSec / 60;

  const sessionId = `sess_${Date.now()}`;
  const lessonId = state.runtime.lesson?.data && 'id' in state.runtime.lesson.data
    ? state.runtime.lesson.data.id
    : undefined;
  const lessonType = state.runtime.lesson?.type;

  if (!state.runtime.isDrill && lessonId && lessonType) {
    const listName = getCompletedListKey(lessonType);
    if (listName) {
      if (!state.progress[listName].includes(lessonId)) {
        state.progress[listName].push(lessonId);
      }
    }

    state.sessions.push({
      id: sessionId,
      ts: new Date().toISOString(),
      contentId: lessonId,
      contentType: lessonType,
      title: getLessonTitle(state.runtime.lesson?.data),
      stage: state.runtime.lesson?.data && 'stage' in state.runtime.lesson.data
        ? state.runtime.lesson.data.stage
        : undefined,
      completionPercent: calculateSessionCompletionPercent(state.runtime.targetTextNorm, finalInput),
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

  const previousSessions = state.sessions.filter((s) =>
    s.contentId === lessonId && s.id !== sessionId,
  );
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

export function startFocusDrill(
  state: AppState,
  data: AppData,
  showScreen: ShowScreenFn,
  persistState?: PersistStateFn,
): void {
  const { trickyWords = [], hardestKeys = [] } = state.runtime.summaryResults || {};
  let drillLesson: Lesson | null = null;

  if (trickyWords.length > 0) {
    const tagsForWord = (word: string): string[] => {
      for (const ws of data.WORDSETS) if (ws.words?.includes(word)) return ws.tags?.phonics || [];
      for (const p of data.PASSAGES) {
        if (p.text && p.text.toLowerCase().split(/\W+/).includes(word)) return p.tags?.phonics || [];
      }
      for (const ph of data.PHONICS) {
        if (ph.text && ph.text.toLowerCase().split(/\W+/).includes(word)) return ph.tags?.phonics || [];
      }
      return [];
    };
    const patterns = new Map<string, string[]>();
    for (const tw of trickyWords) {
      for (const tag of tagsForWord(tw)) {
        const pack = data.PATTERNS.find((pp) => pp.tags?.phonics?.includes(tag));
        if (pack) patterns.set(pack.name, pack.items);
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
