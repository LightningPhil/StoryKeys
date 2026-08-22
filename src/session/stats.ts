import type { Runtime, SessionMetrics } from '../types';
import { normaliseString } from '../utils';

function getTrickyWords(targetText: string, userInput: string): string[] {
  const t = normaliseString(targetText).split(/\s+/);
  const u = normaliseString(userInput).split(/\s+/);
  const tricky = new Set<string>();
  for (let i = 0; i < t.length; i++) {
    if (t[i] !== (u[i] || '')) {
      tricky.add((t[i] ?? '').replace(/[.,;:!?'"“”’‘()-]/g, '').toLowerCase());
    }
  }
  return Array.from(tricky);
}

export function calculateMetrics(finalInput: string, runtime: Runtime): SessionMetrics {
  const targetTextNorm = runtime.targetTextNorm ?? '';
  const startTime = runtime.startTime ?? new Date();
  const flags = runtime.flags;
  const runtimeErrors = runtime.runtimeErrors ?? 0;
  const hardestKeys = runtime.hardestKeys ?? {};
  const targetText = runtime.targetText ?? '';
  const finalInputNorm = normaliseString(finalInput);
  const durationSec = Math.max((Date.now() - startTime.getTime()) / 1000, 0.1);

  const wordsTyped = targetTextNorm.length / 5;

  let finalErrors = 0;
  if (flags?.lockstep) {
    finalErrors = runtimeErrors;
  } else {
    for (let i = 0; i < targetTextNorm.length; i++) {
      if (finalInputNorm[i] !== targetTextNorm[i]) {
        finalErrors++;
      }
    }
  }

  const accuracy = targetTextNorm.length === 0
    ? 0
    : Math.max(0, Math.round(100 * (targetTextNorm.length - finalErrors) / targetTextNorm.length));
  const minutes = durationSec / 60;
  const grossWPM = wordsTyped / minutes;
  const netWPM = grossWPM - (finalErrors / 5) / minutes;

  return {
    accuracy,
    durationSec: parseFloat(durationSec.toFixed(1)),
    errors: finalErrors,
    netWPM: Math.max(0, Math.round(netWPM)),
    grossWPM: Math.max(0, Math.round(grossWPM)),
    hardestKeys: Object.entries(hardestKeys).sort(([, a], [, b]) => b - a).slice(0, 3).map(([k]) => k),
    trickyWords: getTrickyWords(targetText, finalInput).slice(0, 3),
  };
}
