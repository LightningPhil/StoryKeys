import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, it } from 'node:test';

import { DATA } from '../src/data/loader';
import { clearAllStoredData, clearDraft, DRAFT_KEY, loadDraft, saveDraft } from '../src/draft';
import { evaluateEligibleBadges } from '../src/progress/badges';
import { buildLessonKey, calculateSessionCompletionPercent, getLessonCompletionPercent, updateStreak } from '../src/progress/progress';
import { endSession, startSession } from '../src/session/lessons';
import { calculateMetrics, getElapsedSeconds, pauseRuntimeClock, resumeRuntimeClock, startRuntimeClock } from '../src/session/stats';
import { createInitialState, loadState, saveState, shouldShowWelcome } from '../src/state';
import type { BadgeDefinition } from '../src/types';
import { getModalHtml } from '../src/ui/modals';
import { getThemeIcon } from '../src/ui/screens';
import { escapeHtml, formatClock, getLessonTitle, normaliseString, prepareTargetText, rawTrimToNormLen, transformText } from '../src/utils';

class MemoryStorage implements Storage {
  private store = new Map<string, string>();
  get length(): number {
    return this.store.size;
  }
  clear(): void {
    this.store.clear();
  }
  getItem(key: string): string | null {
    return this.store.has(key) ? (this.store.get(key) ?? null) : null;
  }
  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }
}

const storage = new MemoryStorage();
Object.defineProperty(globalThis, 'localStorage', { value: storage, writable: true, configurable: true });

describe('utils', () => {
  it('normalises curly quotes, dashes, ellipsis, and non-breaking spaces', () => {
    assert.equal(normaliseString('It’s “calm”—steady…\u00A0ok'), 'It\'s "calm"-steady... ok');
  });

  it('trims raw input to normalised character budget', () => {
    assert.equal(rawTrimToNormLen('abc…def', 6), 'abc…');
  });

  it('collapses whitespace and formats clock values', () => {
    assert.equal(transformText('  hello   world\nagain  '), 'hello world again');
    assert.equal(formatClock(0), '00:00');
    assert.equal(formatClock(125), '02:05');
    assert.equal(formatClock(-5), '00:00');
  });

  it('escapes HTML entities and derives lesson titles', () => {
    assert.equal(escapeHtml('<b class="x">Tom & \'Jerry\'</b>'), '&lt;b class=&quot;x&quot;&gt;Tom &amp; &#39;Jerry&#39;&lt;/b&gt;');
    assert.equal(getLessonTitle({ id: 'p1', title: 'Foxes' }), 'Foxes');
    assert.equal(getLessonTitle({ id: 'w1', name: 'Verbs', words: ['run'] }), 'Verbs');
  });
});

describe('state & draft persistence', () => {
  beforeEach(() => {
    storage.clear();
  });

  it('round-trips valid settings, progress, and meta through localStorage', () => {
    const s1 = createInitialState();
    s1.settings.theme = 'dark';
    s1.settings.letterSpacing = 4;
    s1.progress.minutesTotal = 12.5;
    s1.progress.completedPassages.push('ks2_fox');
    s1.meta.hasSeenWelcome = true;
    saveState(s1);

    const s2 = createInitialState();
    loadState(s2);
    assert.equal(s2.settings.theme, 'dark');
    assert.equal(s2.settings.letterSpacing, 4);
    assert.equal(s2.progress.minutesTotal, 12.5);
    assert.deepEqual(s2.progress.completedPassages, ['ks2_fox']);
    assert.equal(shouldShowWelcome(s2), false);
  });

  it('falls back to safe defaults when persisted settings are invalid', () => {
    storage.setItem('storykeys_state', JSON.stringify({
      _v: 1,
      settings: { theme: 'neon', font: 'comic', defaultStage: 'KS9', lineHeight: 'bad', letterSpacing: 'bad' },
    }));
    const s = createInitialState();
    loadState(s);
    assert.equal(s.settings.theme, 'cream');
    assert.equal(s.settings.font, 'default');
    assert.equal(s.settings.defaultStage, 'KS2');
    assert.equal(s.settings.lineHeight, 1.7);
    assert.equal(s.settings.letterSpacing, 2);
  });

  it('saves, loads, expires, and clears drafts cleanly', () => {
    const passage = { id: 'ks1_cat', stage: 'KS1', title: 'Cat', text: 'The cat sat.' };
    saveDraft('ks1_cat', 'passage', 'The ', passage);
    const loaded = loadDraft();
    assert.equal(loaded?.lessonId, 'ks1_cat');
    assert.equal(loaded?.typedText, 'The ');

    // Expired draft (>24h) is cleared automatically
    const raw = JSON.parse(storage.getItem(DRAFT_KEY) || '{}');
    raw.savedAt = Date.now() - (25 * 60 * 60 * 1000);
    storage.setItem(DRAFT_KEY, JSON.stringify(raw));
    assert.equal(loadDraft(), null);
    assert.equal(storage.getItem(DRAFT_KEY), null);

    saveDraft('ks1_cat', 'passage', 'The', passage);
    clearDraft();
    assert.equal(loadDraft(), null);

    saveState(createInitialState());
    clearAllStoredData();
    assert.equal(storage.length, 0);
  });
});

describe('progress & stats', () => {
  it('tracks consecutive day streaks across day boundaries', () => {
    const state = createInitialState();
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toDateString();
    state.progress.lastPlayed = yesterday;
    state.progress.consecutiveDays = 2;

    updateStreak(state);
    assert.equal(state.progress.consecutiveDays, 3);
    // Calling twice on the same day does not double-increment
    updateStreak(state);
    assert.equal(state.progress.consecutiveDays, 3);
  });

  it('computes completion percentages and metrics', () => {
    assert.equal(calculateSessionCompletionPercent('hello world', 'hello '), 55);
    assert.equal(calculateSessionCompletionPercent('hello', 'hello'), 100);

    const state = createInitialState();
    state.progress.completedPassages.push('ks2_1');
    const key = buildLessonKey('passage', { id: 'ks2_1', stage: 'KS2' });
    assert.equal(getLessonCompletionPercent(state, key), 100);

    const startTime = new Date(Date.now() - 30_000);
    const metrics = calculateMetrics('The quick brown fox.', {
      targetText: 'The quick brown fox.',
      targetTextNorm: 'The quick brown fox.',
      startTime,
      runtimeErrors: 0,
      hardestKeys: {},
      flags: {
        lockstep: true,
        focusLine: true,
        keyboardHint: false,
        timer: true,
        countdownTimer: false,
        showTimerChip: true,
        punct: true,
      },
    });
    assert.equal(metrics.accuracy, 100);
    assert.equal(metrics.errors, 0);
    assert.ok(metrics.netWPM >= 7 && metrics.netWPM <= 9);
  });

  it('awards Tier-1 practice and accuracy badges on the first completed lesson and counts 58 visible badges', () => {
    const badges = JSON.parse(
      readFileSync(join(process.cwd(), 'public', 'data', 'badges.json'), 'utf8'),
    ) as BadgeDefinition[];
    const appData = { ...DATA, BADGES: badges };
    const state = createInitialState();
    startSession(
      {
        type: 'passage',
        data: { id: 'ks2_1', stage: 'KS2', theme: 'Animals', title: 'Fox', text: 'The fox jumped.' },
      },
      state,
      () => {},
    );
    startRuntimeClock(state.runtime, 1_000);
    endSession('The fox jumped.', state, appData, () => {}, () => {});

    const awarded = state.runtime.summaryResults?.newBadges ?? [];
    assert.ok(awarded.includes('practice_1'), `expected practice_1 in ${awarded.join(', ')}`);
    assert.ok(awarded.includes('accuracy_90'), `expected accuracy_90 in ${awarded.join(', ')}`);

    const modalHtml = getModalHtml('badges', state, appData);
    assert.match(modalHtml, /of 58 earned/);
  });

  it('keeps evaluateEligibleBadges pure and prevents Focus Drills from mutating theme/stage progress', () => {
    const badges = JSON.parse(
      readFileSync(join(process.cwd(), 'public', 'data', 'badges.json'), 'utf8'),
    ) as BadgeDefinition[];
    const appData = { ...DATA, BADGES: badges };
    const state = createInitialState();
    startSession(
      {
        type: 'drill',
        data: { name: 'Focus on: Foxes', words: ['fox', 'box'], stage: 'KS3', theme: 'Animals' },
        withTimer: true,
      },
      state,
      () => {},
    );
    startRuntimeClock(state.runtime, 1_000);

    const snapshotBefore = JSON.stringify({ progress: state.progress, sessions: state.sessions });
    const eligible = evaluateEligibleBadges(
      { accuracy: 100, durationSec: 10, errors: 0, netWPM: 25, grossWPM: 25, hardestKeys: [], trickyWords: [] },
      state,
      appData,
    );
    assert.ok(eligible.includes('accuracy_90'));
    assert.equal(JSON.stringify({ progress: state.progress, sessions: state.sessions }), snapshotBefore);

    endSession('fox box', state, appData, () => {}, () => {});
    assert.deepEqual(state.progress.themesCompleted, {});
    assert.deepEqual(state.progress.stagesCompleted, {});
    assert.equal(state.sessions.length, 0);
  });

  it('waits for first keypress and supports pause/resume even when showTimerDisplay is false', () => {
    const state = createInitialState();
    state.settings.showTimerDisplay = false;
    startSession(
      { type: 'passage', data: { id: 'ks2_calm', stage: 'KS2', title: 'Calm', text: 'Calm steady typing.' } },
      state,
      () => {},
    );
    assert.equal(state.runtime.timer?.started, false);
    assert.equal(getElapsedSeconds(state.runtime, 50_000), 0);

    // Learner starts typing at t = 10_000ms (10s after screen opened)
    startRuntimeClock(state.runtime, 10_000);
    assert.equal(state.runtime.timer?.started, true);
    assert.equal(getElapsedSeconds(state.runtime, 15_000), 5);

    // Manual pause at t = 15_000ms; auto-focus must not unpause manual pause
    assert.equal(pauseRuntimeClock(state.runtime, 'manual', 15_000), true);
    assert.equal(resumeRuntimeClock(state.runtime, 'auto', 25_000), false);
    assert.equal(getElapsedSeconds(state.runtime, 25_000), 5);

    // Manual resume at t = 25_000ms, finish at t = 30_000ms -> 10s active total
    assert.equal(resumeRuntimeClock(state.runtime, 'manual', 25_000), true);
    assert.equal(getElapsedSeconds(state.runtime, 30_000), 10);
  });

  it('hydrates resumed drafts without starting the timer and computes WPM only on newly typed characters', () => {
    const state = createInitialState();
    const text = '12345678901234567890123456789012345678901234567890'; // 50 chars = 10 words
    const draftTyped = text.slice(0, 40); // 80% already typed (40 chars = 8 words)
    startSession(
      { type: 'passage', data: { id: 'ks2_draft', stage: 'KS2', title: 'Draft', text } },
      state,
      () => {},
      undefined,
      { resumedTypedText: draftTyped },
    );
    assert.equal(state.runtime.timer?.started, false);
    assert.equal(state.runtime.baselineChars, 40);

    // Type remaining 10 chars (= 2 words) over 6 seconds -> 20 WPM (not 100 WPM!)
    startRuntimeClock(state.runtime, 1_000);
    const metrics = calculateMetrics(text, state.runtime, 7_000);
    assert.equal(metrics.grossWPM, 20);
    assert.equal(metrics.netWPM, 20);
    assert.equal(metrics.accuracy, 100);
  });

  it('does not inflate WPM or mark lessons complete when a countdown expires early', () => {
    const state = createInitialState();
    const text = 'The quick brown fox jumps over the lazy sleeping dog.';
    startSession(
      { type: 'passage', data: { id: 'ks2_timed', stage: 'KS2', title: 'Timed', text }, withTimer: true },
      state,
      () => {},
    );
    startRuntimeClock(state.runtime, 1_000);

    // Expire with 0 characters typed
    endSession('', state, DATA, () => {}, () => {});
    assert.equal(state.runtime.summaryResults?.netWPM, 0);
    assert.equal(state.runtime.summaryResults?.accuracy, 0);
    assert.equal(state.progress.completedPassages.includes('ks2_timed'), false);
    assert.equal(state.sessions[0]?.completionPercent, 0);
  });

  it('keeps rendered targetText code points 1-to-1 with targetTextNorm across ellipsis and smart quotes', () => {
    const raw = 'Wait… “Don’t rush—breathe!”';
    const target = prepareTargetText(raw, false);
    const norm = normaliseString(target);
    assert.equal(Array.from(target).length, Array.from(norm).length);
    assert.equal(target.length, norm.length);
  });

  it('resolves exact and category-matched icons across KS1-KS4 curriculum themes', () => {
    assert.equal(getThemeIcon('animals'), '🐾');
    assert.equal(getThemeIcon('Physics'), '🔬');
    assert.equal(getThemeIcon('History - Modern'), '🏛️');
    assert.equal(getThemeIcon('Computer Science'), '💻');
    assert.equal(getThemeIcon('Phonics - Phase 3'), '🔤');
    assert.equal(getThemeIcon(undefined, 'spelling'), '📜');
    assert.equal(getThemeIcon(undefined, 'wordset'), '📝');
  });
});
