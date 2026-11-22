import type { Runtime, SessionMetrics } from '../types';
import { normaliseString } from '../utils';

export function startRuntimeClock(runtime: Runtime, nowMs = Date.now()): boolean {
  if (!runtime.timer || runtime.timer.started) return false;
  runtime.timer.started = true;
  runtime.timer.paused = false;
  runtime.timer.manualPaused = false;
  runtime.timer.autoPaused = false;
  runtime.timer.startedAtMs = nowMs;
  runtime.startTime = new Date(nowMs);
  if (runtime.timer.tick && !runtime.timer.handle) {
    runtime.timer.handle = setInterval(runtime.timer.tick, 1000);
    runtime.timer.tick();
  }
  return true;
}

export function pauseRuntimeClock(runtime: Runtime, kind: 'manual' | 'auto', nowMs = Date.now()): boolean {
  const timer = runtime.timer;
  if (!timer || !timer.started) return false;
  if (timer.paused) {
    if (kind === 'manual' && timer.autoPaused) {
      timer.autoPaused = false;
      timer.manualPaused = true;
      return true;
    }
    return false;
  }
  if (timer.startedAtMs !== null) {
    timer.accumulatedMs += Math.max(0, nowMs - timer.startedAtMs);
    timer.startedAtMs = null;
  }
  timer.paused = true;
  timer.manualPaused = kind === 'manual';
  timer.autoPaused = kind === 'auto';
  return true;
}

export function resumeRuntimeClock(runtime: Runtime, kind: 'manual' | 'auto', nowMs = Date.now()): boolean {
  const timer = runtime.timer;
  if (!timer || !timer.started || !timer.paused) return false;
  if (kind === 'auto' && !timer.autoPaused) return false;
  timer.paused = false;
  timer.manualPaused = false;
  timer.autoPaused = false;
  timer.startedAtMs = nowMs;
  return true;
}

export function getElapsedSeconds(runtime: Runtime, nowMs = Date.now()): number {
  if (runtime.timer) {
    if (!runtime.timer.started) return 0;
    const activeMs = (!runtime.timer.paused && runtime.timer.startedAtMs !== null)
      ? Math.max(0, nowMs - runtime.timer.startedAtMs)
      : 0;
    return (runtime.timer.accumulatedMs + activeMs) / 1000;
  }
  if (runtime.startTime) {
    return Math.max(0, (nowMs - runtime.startTime.getTime()) / 1000);
  }
  return 0;
}

function getTrickyWords(targetText: string, userInput: string, isComplete: boolean): string[] {
  const targetWords = normaliseString(targetText).split(/\s+/).filter(Boolean);
  const trimmedInput = normaliseString(userInput).trim();
  const userWords = trimmedInput ? trimmedInput.split(/\s+/) : [];
  const limit = isComplete ? targetWords.length : Math.min(targetWords.length, userWords.length);
  const tricky = new Set<string>();
  for (let i = 0; i < limit; i++) {
    if (targetWords[i] !== (userWords[i] || '')) {
      const cleaned = (targetWords[i] ?? '').replace(/[.,;:!?'"“”’‘()-]/g, '').toLowerCase();
      if (cleaned) tricky.add(cleaned);
    }
  }
  return Array.from(tricky);
}

export function calculateMetrics(finalInput: string, runtime: Runtime, nowMs = Date.now()): SessionMetrics {
  const targetTextNorm = runtime.targetTextNorm ?? '';
  const flags = runtime.flags;
  const runtimeErrors = runtime.runtimeErrors ?? 0;
  const hardestKeys = runtime.hardestKeys ?? {};
  const targetText = runtime.targetText ?? '';
  const finalInputNorm = normaliseString(finalInput);
  const baselineChars = Math.min(runtime.baselineChars ?? 0, finalInputNorm.length);
  const newlyTypedChars = Math.max(0, finalInputNorm.length - baselineChars);
  const attemptedLen = Math.min(targetTextNorm.length, finalInputNorm.length);
  const isComplete = targetTextNorm.length > 0 && finalInputNorm.length >= targetTextNorm.length;

  const rawElapsedSec = getElapsedSeconds(runtime, nowMs);
  const durationSec = newlyTypedChars > 0 ? Math.max(rawElapsedSec, 0.1) : rawElapsedSec;

  let finalErrors = 0;
  if (flags?.lockstep) {
    finalErrors = runtimeErrors;
  } else {
    const evalStart = baselineChars;
    for (let i = evalStart; i < attemptedLen; i++) {
      if (finalInputNorm[i] !== targetTextNorm[i]) {
        finalErrors++;
      }
    }
  }

  let accuracy = 0;
  if (attemptedLen > 0) {
    if (flags?.lockstep) {
      const denom = Math.max(newlyTypedChars, attemptedLen);
      accuracy = Math.max(0, Math.round((100 * (denom - finalErrors)) / denom));
    } else {
      let totalMismatches = 0;
      for (let i = 0; i < attemptedLen; i++) {
        if (finalInputNorm[i] !== targetTextNorm[i]) totalMismatches++;
      }
      accuracy = Math.max(0, Math.round((100 * (attemptedLen - totalMismatches)) / attemptedLen));
    }
  }

  let grossWPM = 0;
  let netWPM = 0;
  if (newlyTypedChars > 0 && durationSec > 0) {
    const minutes = durationSec / 60;
    const wordsTyped = newlyTypedChars / 5;
    grossWPM = wordsTyped / minutes;
    netWPM = grossWPM - (finalErrors / 5) / minutes;
  }

  return {
    accuracy,
    durationSec: parseFloat(durationSec.toFixed(1)),
    errors: finalErrors,
    netWPM: Math.max(0, Math.round(netWPM)),
    grossWPM: Math.max(0, Math.round(grossWPM)),
    hardestKeys: Object.entries(hardestKeys).sort(([, a], [, b]) => b - a).slice(0, 3).map(([k]) => k),
    trickyWords: getTrickyWords(targetText, finalInput, isComplete).slice(0, 3),
  };
}
