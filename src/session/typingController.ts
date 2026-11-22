import { isSpeaking, isSpeechAvailable, speakText, stopSpeaking } from '../audio/sounds';
import { clearDraft, saveDraft } from '../draft';
import type { AppData, AppState, PersistStateFn, ShowScreenFn } from '../types';
import { toast } from '../ui/feedback';
import { debounce, formatClock, getElement, normaliseString } from '../utils';
import { calculateVisualLines, handleTypingInput, updateTypingDisplay } from './keyboard';
import { endSession } from './lessons';
import { getElapsedSeconds, pauseRuntimeClock, resumeRuntimeClock } from './stats';

export interface TypingMountContext {
  state: AppState;
  data: AppData;
  showScreen: ShowScreenFn;
  persist: PersistStateFn;
  onRequestExit: () => void;
}

const debouncedSaveDraft = debounce((appState: AppState, typedText: string) => {
  const lessonId = appState.runtime.lesson?.data.id;
  const lessonType = appState.runtime.lesson?.type;
  const lessonData = appState.runtime.lesson?.data;
  if (lessonId && lessonType && lessonData && typedText.length > 0) {
    saveDraft(lessonId, lessonType, typedText, lessonData);
  }
}, 2000);

export function cancelPendingDraftSave(): void {
  debouncedSaveDraft.cancel();
}

export function saveCurrentTypingDraft(state: AppState): void {
  debouncedSaveDraft.cancel();
  const input = getElement<HTMLTextAreaElement>('typing-input');
  const typedText = input ? input.value : '';
  const lessonId = state.runtime.lesson?.data.id;
  const lessonType = state.runtime.lesson?.type;
  const lessonData = state.runtime.lesson?.data;
  if (lessonId && lessonType && lessonData) {
    saveDraft(lessonId, lessonType, typedText, lessonData);
    if (typedText.length > 0) {
      toast('Draft saved. You can resume later.');
    }
  }
}

function setReadAloudButtonIdle(btn: HTMLElement): void {
  btn.classList.remove('speaking');
  btn.innerHTML = '<span aria-hidden="true">🔊</span> Read aloud';
}

function setReadAloudButtonSpeaking(btn: HTMLElement): void {
  btn.classList.add('speaking');
  btn.innerHTML = '<span aria-hidden="true">⏹️</span> Stop';
}

export function mountTypingScreen(ctx: TypingMountContext): void {
  const { state, data, showScreen, persist, onRequestExit } = ctx;
  const controller = new AbortController();
  state.runtime.abortController = controller;
  const { signal } = controller;

  calculateVisualLines(state, data);
  const onResize = debounce(() => calculateVisualLines(state, data), 250);
  window.addEventListener('resize', onResize, { signal });

  window.addEventListener('blur', () => {
    pauseRuntimeClock(state.runtime, 'auto');
  }, { signal });

  window.addEventListener('focus', () => {
    resumeRuntimeClock(state.runtime, 'auto');
  }, { signal });

  getElement('exit-lesson-btn')?.addEventListener('click', onRequestExit, { signal });

  const input = getElement<HTMLTextAreaElement>('typing-input');
  const progressBar = getElement('typing-progress-bar');
  const progressTrack = progressBar?.parentElement;
  const pauseOverlay = getElement('pause-overlay');
  const capsLockIndicator = getElement('caps-lock-indicator');
  if (!input) return;

  const updateCapsLockState = (e: KeyboardEvent) => {
    if (capsLockIndicator && e.getModifierState) {
      capsLockIndicator.classList.toggle('active', e.getModifierState('CapsLock'));
    }
  };
  input.addEventListener('keydown', updateCapsLockState, { signal });
  input.addEventListener('keyup', updateCapsLockState, { signal });

  state.runtime.wpmSamples = [];
  state.runtime.wpmSampleInterval = null;

  const finishSession = (finalInput: string) => {
    debouncedSaveDraft.cancel();
    clearDraft();
    if (state.runtime.wpmSampleInterval) {
      clearInterval(state.runtime.wpmSampleInterval);
      state.runtime.wpmSampleInterval = null;
    }
    endSession(finalInput, state, data, showScreen, persist);
  };

  const updateProgressBar = () => {
    if (progressBar && state.runtime.targetTextNorm) {
      const typed = normaliseString(input.value).length;
      const total = state.runtime.targetTextNorm.length;
      const pct = total > 0 ? Math.min(100, (typed / total) * 100) : 0;
      progressBar.style.width = `${pct}%`;
      progressTrack?.setAttribute('aria-valuenow', String(Math.round(pct)));
    }
  };

  if (state.runtime.initialInput) {
    input.value = state.runtime.initialInput;
    updateTypingDisplay(input.value, state, data, { isUserAction: false });
    updateProgressBar();
  }

  input.addEventListener('input', (e) => {
    handleTypingInput(e, state, data, finishSession);
    updateProgressBar();
    debouncedSaveDraft(state, input.value);
    if (!state.runtime.wpmSampleInterval && state.runtime.timer?.started) {
      state.runtime.wpmSampleInterval = setInterval(() => {
        if (!state.runtime.timer?.paused) {
          const elapsed = getElapsedSeconds(state.runtime);
          const baseline = state.runtime.baselineChars ?? 0;
          const newlyTyped = Math.max(0, normaliseString(input.value).length - baseline);
          if (elapsed > 0 && newlyTyped > 0) {
            state.runtime.wpmSamples = state.runtime.wpmSamples ?? [];
            state.runtime.wpmSamples.push(Math.round((newlyTyped / 5 / elapsed) * 60));
          }
        }
      }, 3000);
    }
  }, { signal });

  input.addEventListener('paste', (e) => {
    e.preventDefault();
    toast(data.COPY.pasteBlocked);
  }, { signal });

  getElement<HTMLInputElement>('lockstep-toggle')?.addEventListener('change', (e) => {
    if (state.runtime.flags && e.target instanceof HTMLInputElement) {
      state.runtime.flags.lockstep = e.target.checked;
    }
  }, { signal });

  getElement<HTMLInputElement>('focusline-toggle')?.addEventListener('change', (e) => {
    if (state.runtime.flags && e.target instanceof HTMLInputElement) {
      state.runtime.flags.focusLine = e.target.checked;
      getElement('typing-target')?.classList.toggle('focus-line-active', e.target.checked);
    }
  }, { signal });

  const togglePause = () => {
    if (!state.runtime.timer?.started) return;
    if (!state.runtime.timer.paused || state.runtime.timer.autoPaused) {
      pauseRuntimeClock(state.runtime, 'manual');
      pauseOverlay?.classList.remove('hidden');
      input.blur();
    } else {
      resumeRuntimeClock(state.runtime, 'manual');
      pauseOverlay?.classList.add('hidden');
      input.focus();
    }
  };

  window.addEventListener('keydown', (e: KeyboardEvent) => {
    if (state.ui.modal) return;
    if (e.key === 'Escape') {
      if (state.runtime.timer?.started) togglePause();
    } else if (e.key === ' ' && state.runtime.timer?.manualPaused) {
      e.preventDefault();
      togglePause();
    }
  }, { signal });

  const readAloudBtn = getElement('read-aloud-btn');
  if (readAloudBtn) {
    if (!isSpeechAvailable()) {
      if (readAloudBtn instanceof HTMLButtonElement) readAloudBtn.disabled = true;
      readAloudBtn.title = 'Text-to-speech not available in this browser';
    } else {
      readAloudBtn.addEventListener('click', () => {
        if (isSpeaking()) {
          stopSpeaking();
          setReadAloudButtonIdle(readAloudBtn);
        } else if (state.runtime.targetText) {
          setReadAloudButtonSpeaking(readAloudBtn);
          speakText(
            state.runtime.targetText,
            () => setReadAloudButtonIdle(readAloudBtn),
            null,
            { gender: state.settings.voiceGender, speed: state.settings.voiceSpeed },
          );
        }
      }, { signal });
    }
  }

  input.focus();

  if (state.runtime.flags?.timer && state.runtime.timer) {
    const chip = getElement('timer-chip');
    if (chip) {
      chip.textContent = state.runtime.flags.countdownTimer
        ? formatClock(state.runtime.timer.remaining)
        : formatClock(0);
      chip.title = 'Timer starts when you begin typing';
    }

    state.runtime.timer.tick = () => {
      if (state.runtime.timer?.paused) return;
      if (state.runtime.flags?.countdownTimer && state.runtime.timer) {
        state.runtime.timer.remaining--;
        if (chip) chip.textContent = formatClock(state.runtime.timer.remaining);
        if (state.runtime.timer.remaining <= 0) {
          if (state.runtime.timer.handle) {
            clearInterval(state.runtime.timer.handle);
            state.runtime.timer.handle = null;
          }
          const inputEl = getElement<HTMLTextAreaElement>('typing-input');
          finishSession(inputEl ? inputEl.value : '');
        }
      } else if (chip) {
        chip.textContent = formatClock(Math.floor(getElapsedSeconds(state.runtime)));
      }
    };
  }
}
