import type { AppData, AppState, FingerZone } from '../types';
import { playClickSound, playErrorSound } from '../audio/sounds';
import { getElement, normaliseString, rawTrimToNormLen } from '../utils';

export const FINGER_ZONES: Record<string, FingerZone> = {
  q: 'lp', a: 'lp', z: 'lp', '1': 'lp',
  w: 'lr', s: 'lr', x: 'lr', '2': 'lr',
  e: 'lm', d: 'lm', c: 'lm', '3': 'lm',
  r: 'li', f: 'li', v: 'li', t: 'li', g: 'li', b: 'li', '4': 'li', '5': 'li',
  y: 'ri', h: 'ri', n: 'ri', u: 'ri', j: 'ri', m: 'ri', '6': 'ri', '7': 'ri',
  i: 'rm', k: 'rm', ',': 'rm', '8': 'rm',
  o: 'rr', l: 'rr', '.': 'rr', '9': 'rr',
  p: 'rp', ';': 'rp', '/': 'rp', '0': 'rp',
  ' ': 'thumb',
};

export function handleTypingInput(
  e: Event,
  state: AppState,
  data: AppData,
  endSession: (finalInput: string) => void,
): void {
  if (!state.runtime.targetTextNorm) return;
  const input = e.target;
  if (!(input instanceof HTMLTextAreaElement)) return;

  updateTypingDisplay(input.value, state, data);

  if (normaliseString(input.value).length >= state.runtime.targetTextNorm.length) {
    input.disabled = true;
    const finalInput = rawTrimToNormLen(input.value, state.runtime.targetTextNorm.length);
    setTimeout(() => endSession(finalInput), 100);
  }
}

export function updateTypingDisplay(userInput: string, state: AppState, _data: AppData): void {
  const targetTextNorm = state.runtime.targetTextNorm;
  const flags = state.runtime.flags;
  const hardestKeys = state.runtime.hardestKeys;
  const lineElements = state.runtime.lineElements;
  if (!targetTextNorm || !flags || !hardestKeys) return;

  const targetEl = getElement('typing-target');
  if (!targetEl) return;
  const userInputNorm = normaliseString(userInput);

  if (flags.lockstep && userInputNorm.length > 0 && userInputNorm.slice(-1) !== targetTextNorm[userInputNorm.length - 1]) {
    const inputEl = getElement<HTMLTextAreaElement>('typing-input');
    if (!inputEl) return;
    inputEl.value = userInput.slice(0, -1);
    state.runtime.runtimeErrors = (state.runtime.runtimeErrors ?? 0) + 1;
    const key = targetTextNorm[userInputNorm.length - 1];
    if (key && key !== ' ') hardestKeys[key] = (hardestKeys[key] || 0) + 1;

    playErrorSound(state.settings.soundEnabled);
    inputEl.classList.add('is-error');
    setTimeout(() => { inputEl.classList.remove('is-error'); }, 200);
    return;
  }

  if (userInputNorm.length > 0) {
    const lastIndex = userInputNorm.length - 1;
    const isCorrect = userInputNorm[lastIndex] === targetTextNorm[lastIndex];
    if (isCorrect) {
      playClickSound(state.settings.soundEnabled);
      if (state.runtime.timer && !state.runtime.timer.started && state.runtime.flags?.timer) {
        state.runtime.timer.started = true;
        state.runtime.startTime = new Date();
        if (state.runtime.timer.tick) {
          state.runtime.timer.handle = setInterval(state.runtime.timer.tick, 1000);
          state.runtime.timer.tick();
        }
      }
    } else {
      playErrorSound(state.settings.soundEnabled);
    }
  }

  if (!flags.lockstep && userInputNorm.length > 0) {
    const lastIndex = userInputNorm.length - 1;
    if (userInputNorm[lastIndex] !== targetTextNorm[lastIndex]) {
      const key = targetTextNorm[lastIndex];
      if (key && key !== ' ') hardestKeys[key] = (hardestKeys[key] || 0) + 1;
    }
  }

  const nextIdx = userInputNorm.length;

  if (lineElements && lineElements.length > 0) {
    lineElements.forEach((el) => el.classList.remove('current-line'));
    let currentLine: HTMLElement | null = null;
    if (nextIdx < targetTextNorm.length) {
      const nextCharEl = targetEl.querySelector(`.char[data-idx="${nextIdx}"]`);
      if (nextCharEl instanceof HTMLElement) currentLine = nextCharEl.parentElement;
    } else if (lineElements.length > 0) {
      currentLine = lineElements[lineElements.length - 1] ?? null;
    }
    if (currentLine) currentLine.classList.add('current-line');
  }

  if (state.runtime.lesson?.type === 'spelling' && lineElements?.length) {
    const vanished = state.runtime.vanishedLines ?? new Set<number>();
    lineElements.forEach((line) => {
      const startIdx = Number(line.dataset.startIdx);
      if (Number.isFinite(startIdx) && userInputNorm.length > startIdx) {
        vanished.add(startIdx);
      }
      line.classList.toggle('vanished', vanished.has(Number(line.dataset.startIdx)));
    });
    state.runtime.vanishedLines = vanished;
  }

  const chars = Array.from(targetEl.querySelectorAll('.char'));
  chars.forEach((span) => {
    if (!(span instanceof HTMLElement)) return;
    const i = parseInt(span.dataset.idx ?? '', 10);
    span.className = 'char';
    if (i < userInputNorm.length) {
      span.classList.add(userInputNorm[i] === targetTextNorm[i] ? 'correct' : 'incorrect');
    }
    if (i === nextIdx) {
      span.classList.add('current');
    }
  });

  const nextKey = nextIdx < targetTextNorm.length ? targetTextNorm[nextIdx] : null;
  const fingerHint = getElement('finger-hint');
  if (fingerHint) {
    const fingers = fingerHint.querySelectorAll('.finger');
    const activeZone = nextKey ? FINGER_ZONES[nextKey.toLowerCase()] : undefined;
    fingers.forEach((f) => {
      if (f instanceof SVGElement || f instanceof HTMLElement) {
        f.classList.toggle('active', f.getAttribute('data-finger') === activeZone);
      }
    });
  }

  if (nextKey && flags.keyboardHint) {
    const keyboardEl = getElement('keyboard-hint');
    if (!keyboardEl) return;
    keyboardEl.querySelector('.key.highlight')?.classList.remove('highlight');
    const nextKeyEl = keyboardEl.querySelector(`.key[data-key="${nextKey.toLowerCase()}"]`);
    nextKeyEl?.classList.add('highlight');
  }
}

export function calculateVisualLines(state: AppState, data: AppData): void {
  const container = getElement('typing-target');
  if (!container) return;

  const existingLines = Array.from(container.querySelectorAll('.line'));
  if (existingLines.length) {
    const frag = document.createDocumentFragment();
    existingLines.forEach((line) => {
      Array.from(line.querySelectorAll('.char')).forEach((ch) => frag.appendChild(ch));
    });
    container.innerHTML = '';
    container.appendChild(frag);
  }

  requestAnimationFrame(() => {
    const chars = Array.from(container.querySelectorAll('.char'));
    if (!chars.length) return;

    const groups: HTMLElement[][] = [];
    let lastTop: number | null = null;
    chars.forEach((ch) => {
      if (!(ch instanceof HTMLElement)) return;
      const top = ch.offsetTop;
      if (lastTop === null || top !== lastTop) {
        groups.push([]);
        lastTop = top;
      }
      groups[groups.length - 1]?.push(ch);
    });

    const frag2 = document.createDocumentFragment();
    const lineEls: HTMLElement[] = [];
    groups.forEach((group) => {
      const div = document.createElement('div');
      div.className = 'line';
      const firstVisibleChar = group.find((ch) => ch.textContent !== '\n') || group[0];
      if (firstVisibleChar) div.dataset.startIdx = firstVisibleChar.dataset.idx;
      group.forEach((ch) => div.appendChild(ch));
      frag2.appendChild(div);
      lineEls.push(div);
    });

    container.innerHTML = '';
    container.appendChild(frag2);
    state.runtime.lineElements = lineEls;

    const inputEl = getElement<HTMLTextAreaElement>('typing-input');
    updateTypingDisplay(inputEl ? inputEl.value : '', state, data);
  });
}
