import { isSpeaking, isSpeechAvailable, speakText, stopSpeaking } from './audio/sounds';
import { APP_VERSION, SCHEMA_VERSION } from './config';
import { DATA, ensureLessonLoaded, findLesson, loadInitialData, loadStageData } from './data/loader';
import { clearAllStoredData, clearDraft, loadDraft, saveDraft, STATE_KEY } from './draft';
import { endSession, startFocusDrill, startSession, teardownRuntime } from './session/lessons';
import { calculateVisualLines, handleTypingInput } from './session/keyboard';
import { createInitialState, loadState, markWelcomeSeen, saveState, shouldShowWelcome } from './state';
import type {
  AppState,
  CompletedListKey,
  FontName,
  Lesson,
  LessonData,
  LessonType,
  ModalName,
  ScreenName,
  Stage,
  ThemeName,
  VoiceGender,
} from './types';
import { isLessonType, isStage } from './types';
import { applySettings, printCertificate, toast, triggerConfetti } from './ui/feedback';
import { getModalHtml } from './ui/modals';
import { getLessonPickerState, handleLessonPickerPagination, resetLessonPickerState, updateLessonPicker } from './ui/picker';
import { getScreenHtml } from './ui/screens';
import { debounce, formatClock, getElement, sha256Hex } from './utils';

const state: AppState = createInitialState();

const debouncedSaveDraft = debounce((appState: AppState, typedText: string) => {
  const lessonId = appState.runtime.lesson?.data && 'id' in appState.runtime.lesson.data
    ? appState.runtime.lesson.data.id
    : undefined;
  const lessonType = appState.runtime.lesson?.type;
  const lessonData = appState.runtime.lesson?.data;
  if (lessonId && lessonType && lessonData && typedText.length > 0) {
    saveDraft(lessonId, lessonType, typedText, lessonData);
  }
}, 2000);

function persist(): void {
  saveState(state);
}

function pickFreshLesson(pool: LessonData[], type: LessonType): LessonData | null {
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

function showScreen(screenName: ScreenName): void {
  teardownRuntime(state.runtime);
  stopSpeaking();
  state.ui.currentScreen = screenName;
  const mainContent = getElement('main-content');
  if (!mainContent) return;
  mainContent.innerHTML = getScreenHtml(screenName, state, DATA);
  bindScreenEvents(screenName);
  window.scrollTo(0, 0);
}

let modalCloseTimer: ReturnType<typeof setTimeout> | null = null;

function showModal(modalName: ModalName, options: { scrollToId?: string } = {}): void {
  if (modalCloseTimer) {
    clearTimeout(modalCloseTimer);
    modalCloseTimer = null;
  }
  if (!state.ui.modal) {
    state.ui.lastFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  }
  state.ui.modal = modalName;
  const modalContainer = getElement('modal-container');
  if (!modalContainer) return;
  modalContainer.innerHTML = getModalHtml(modalName, state, DATA);

  if (modalName === 'lessonPicker') {
    resetLessonPickerState(state.settings.defaultStage);
  }

  document.body.classList.add('modal-open');
  const modal = modalContainer.querySelector('.modal');
  if (!(modal instanceof HTMLElement)) return;
  bindModalEvents(modalName);
  modal.classList.add('active');

  // Focus the dialog itself rather than the first control (which is the close
  // button), so opening a modal never lands the caret on "dismiss". Modals that
  // want a specific field can opt in with data-autofocus.
  const autofocus = modal.querySelector<HTMLElement>('[data-autofocus]');
  const content = modal.querySelector<HTMLElement>('.modal-content');
  if (autofocus) {
    autofocus.focus();
  } else if (content) {
    content.tabIndex = -1;
    content.focus();
  }
  if (options.scrollToId) {
    const target = modal.querySelector(`#${options.scrollToId}`);
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function closeModal(): void {
  const modalContainer = getElement('modal-container');
  const modalEl = modalContainer?.querySelector('.modal');
  if (!modalEl) {
    document.body.classList.remove('modal-open');
    state.ui.modal = null;
    return;
  }
  if (state.ui.modal === 'welcome') {
    markWelcomeSeen(state, persist);
  }
  modalEl.classList.remove('active');
  document.body.classList.remove('modal-open');
  if (modalCloseTimer) clearTimeout(modalCloseTimer);
  const opener = state.ui.lastFocus;
  modalCloseTimer = setTimeout(() => {
    modalCloseTimer = null;
    if (modalContainer) modalContainer.innerHTML = '';
    state.ui.modal = null;
    if (opener && typeof opener.focus === 'function') {
      try { opener.focus(); } catch { /* element may have been removed */ }
    }
  }, 200);
}

function saveTypingDraft(): void {
  const input = getElement<HTMLTextAreaElement>('typing-input');
  const typedText = input ? input.value : '';
  const lessonId = state.runtime.lesson?.data && 'id' in state.runtime.lesson.data
    ? state.runtime.lesson.data.id
    : undefined;
  const lessonType = state.runtime.lesson?.type;
  const lessonData = state.runtime.lesson?.data;
  if (lessonId && lessonType && lessonData) {
    saveDraft(lessonId, lessonType, typedText, lessonData);
    if (typedText.length > 0) {
      toast('Draft saved. You can resume later.');
    }
  }
}

function requestLeaveTyping(): boolean {
  if (!confirm('Exit lesson? Your progress will be saved as a draft.')) {
    return false;
  }
  saveTypingDraft();
  showScreen('home');
  return true;
}

function startLesson(lesson: Lesson): void {
  startSession(lesson, state, showScreen, persist);
}

function bindAppEvents(): void {
  getElement('about-btn')?.addEventListener('click', () => {
    closeModal();
    if (state.ui.currentScreen === 'typing') {
      requestLeaveTyping();
      return;
    }
    showScreen('home');
  });
  getElement('help-btn')?.addEventListener('click', () => showModal('help'));
  getElement('start-here-btn')?.addEventListener('click', () => showModal('welcome'));
  getElement('settings-btn')?.addEventListener('click', () => showModal('settings'));
  getElement('parent-btn')?.addEventListener('click', () => {
    if (state.settings.pin) showModal('pin');
    else showModal('parent');
  });
  getElement('footer-privacy-link')?.addEventListener('click', () => {
    showModal('help', { scrollToId: 'help-data-privacy' });
  });
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && state.ui.modal) {
      e.preventDefault();
      closeModal();
    }
  });
  window.addEventListener('blur', () => {
    if (state.ui.currentScreen === 'typing' && state.runtime.timer?.started && !state.runtime.timer.paused) {
      state.runtime.timer.paused = true;
      state.runtime.pauseStartTime = new Date();
      state.runtime._autoPaused = true;
    }
  });
  window.addEventListener('focus', () => {
    if (state.runtime._autoPaused && state.runtime.timer) {
      if (state.runtime.pauseStartTime && state.runtime.startTime) {
        const pauseDuration = Date.now() - state.runtime.pauseStartTime.getTime();
        state.runtime.startTime = new Date(state.runtime.startTime.getTime() + pauseDuration);
      }
      state.runtime.timer.paused = false;
      state.runtime._autoPaused = false;
    }
  });
}

function bindHomeEvents(): void {
  getElement('resume-draft-btn')?.addEventListener('click', () => {
    const draft = loadDraft();
    if (draft?.lessonData && isLessonType(draft.lessonType)) {
      const onSessionStart = () => {
        setTimeout(() => {
          const input = getElement<HTMLTextAreaElement>('typing-input');
          if (input) {
            input.value = draft.typedText;
            input.dispatchEvent(new Event('input', { bubbles: true }));
          }
        }, 100);
      };
      startSession({ type: draft.lessonType, data: draft.lessonData }, state, (screen) => {
        showScreen(screen);
        if (screen === 'typing') onSessionStart();
      }, persist);
    }
  });

  getElement('discard-draft-btn')?.addEventListener('click', () => {
    clearDraft();
    showScreen('home');
    toast('Draft discarded.');
  });

  getElement('new-story-card')?.addEventListener('click', async (e) => {
    const target = e.target;
    if (!(target instanceof HTMLElement)) return;
    const stageBtn = target.closest('[data-stage]');
    if (stageBtn instanceof HTMLElement && stageBtn.dataset.stage) {
      const stage = stageBtn.dataset.stage;
      toast(`Finding a new ${stage} story...`);
      await loadStageData(stage);
      const lessonData = pickFreshLesson(DATA.PASSAGES.filter((p) => p.stage === stage), 'passage');
      if (!lessonData) {
        toast(`No ${stage} passages are available yet. Please try another stage.`);
        return;
      }
      startLesson({ type: 'passage', data: lessonData });
      return;
    }

    const spellingBtn = target.closest('[data-spelling-stage]');
    if (spellingBtn instanceof HTMLElement && spellingBtn.dataset.spellingStage) {
      const stage = spellingBtn.dataset.spellingStage;
      const stageSpellings = DATA.SPELLING.filter((item) => item.stage === stage);
      if (!stageSpellings.length) {
        toast(`No spelling lists found for ${stage} yet. Please try another stage.`);
        return;
      }
      const lessonData = pickFreshLesson(stageSpellings, 'spelling');
      if (!lessonData) {
        toast(`No fresh spelling lists found for ${stage}. Please try another stage.`);
        return;
      }
      startLesson({ type: 'spelling', data: lessonData });
    }
  });

  getElement('phonics-mode-btn')?.addEventListener('click', () => {
    if (!DATA.PHONICS.length) {
      toast('Phonics passages are still loading. Please try again in a moment.');
      return;
    }
    const lessonData = pickFreshLesson(DATA.PHONICS, 'phonics');
    if (!lessonData) {
      toast('No phonics passages available yet. Please try again later.');
      return;
    }
    startLesson({ type: 'phonics', data: lessonData });
  });

  getElement('browse-lessons-btn')?.addEventListener('click', () => showModal('lessonPicker'));
  getElement('view-badges-btn')?.addEventListener('click', () => showModal('badges'));

  document.querySelector('.recent-lessons-list')?.addEventListener('click', async (e) => {
    const btn = e.target instanceof Element ? e.target.closest('.recent-lesson-btn') : null;
    if (!(btn instanceof HTMLElement)) return;
    const id = btn.dataset.recentId;
    const type = btn.dataset.recentType;
    const stage = btn.dataset.recentStage;
    if (!id || !type) return;
    const lessonData = await ensureLessonLoaded(type, id, stage);
    if (lessonData && isLessonType(type)) {
      startLesson({ type, data: lessonData });
    } else {
      toast('Could not find that lesson. It may have been removed.');
    }
  });
}

function bindTypingEvents(): void {
  requestAnimationFrame(() => calculateVisualLines(state, DATA));
  const onResize = debounce(() => calculateVisualLines(state, DATA), 250);
  window.addEventListener('resize', onResize);
  state.runtime._cleanupResize = () => window.removeEventListener('resize', onResize);

  getElement('exit-lesson-btn')?.addEventListener('click', () => { requestLeaveTyping(); });

  const input = getElement<HTMLTextAreaElement>('typing-input');
  const progressBar = getElement('typing-progress-bar');
  const pauseOverlay = getElement('pause-overlay');
  const capsLockIndicator = getElement('caps-lock-indicator');
  if (!input) return;

  const updateCapsLockState = (e: KeyboardEvent) => {
    if (capsLockIndicator && e.getModifierState) {
      capsLockIndicator.classList.toggle('active', e.getModifierState('CapsLock'));
    }
  };
  input.addEventListener('keydown', updateCapsLockState);
  input.addEventListener('keyup', updateCapsLockState);

  state.runtime.wpmSamples = [];
  state.runtime.wpmSampleInterval = null;

  const sessionEndCallback = (finalInput: string) => {
    debouncedSaveDraft.cancel();
    clearDraft();
    if (state.runtime.wpmSampleInterval) clearInterval(state.runtime.wpmSampleInterval);
    endSession(finalInput, state, DATA, showScreen, persist);
  };

  const updateProgressBar = () => {
    if (progressBar && state.runtime.targetTextNorm) {
      const typed = input.value.length;
      const total = state.runtime.targetTextNorm.length;
      progressBar.style.width = `${Math.min(100, (typed / total) * 100)}%`;
    }
  };

  input.addEventListener('input', (e) => {
    handleTypingInput(e, state, DATA, sessionEndCallback);
    updateProgressBar();
    debouncedSaveDraft(state, input.value);
    if (!state.runtime.wpmSampleInterval && state.runtime.timer?.started) {
      state.runtime.wpmSampleInterval = setInterval(() => {
        if (state.runtime.startTime && !state.runtime.timer?.paused) {
          const elapsed = (Date.now() - state.runtime.startTime.getTime()) / 1000;
          if (elapsed > 0) {
            state.runtime.wpmSamples = state.runtime.wpmSamples ?? [];
            state.runtime.wpmSamples.push(Math.round((input.value.length / 5 / elapsed) * 60));
          }
        }
      }, 3000);
    }
  });
  input.addEventListener('paste', (e) => {
    e.preventDefault();
    toast(DATA.COPY.pasteBlocked);
  });

  getElement<HTMLInputElement>('lockstep-toggle')?.addEventListener('change', (e) => {
    if (state.runtime.flags && e.target instanceof HTMLInputElement) {
      state.runtime.flags.lockstep = e.target.checked;
    }
  });
  getElement<HTMLInputElement>('focusline-toggle')?.addEventListener('change', (e) => {
    if (state.runtime.flags && e.target instanceof HTMLInputElement) {
      state.runtime.flags.focusLine = e.target.checked;
      getElement('typing-target')?.classList.toggle('focus-line-active', e.target.checked);
    }
  });

  const togglePause = () => {
    if (!state.runtime.timer?.started) return;
    const isPaused = !state.runtime.timer.paused;
    state.runtime.timer.paused = isPaused;
    pauseOverlay?.classList.toggle('hidden', !isPaused);
    if (isPaused) {
      input.blur();
      state.runtime.pauseStartTime = new Date();
    } else {
      if (state.runtime.pauseStartTime && state.runtime.startTime) {
        const pauseDuration = Date.now() - state.runtime.pauseStartTime.getTime();
        state.runtime.startTime = new Date(state.runtime.startTime.getTime() + pauseDuration);
      }
      input.focus();
    }
  };

  const pauseKeyHandler = (e: KeyboardEvent) => {
    if (state.ui.modal) return;
    if (e.key === 'Escape') {
      if (state.runtime.timer?.started) togglePause();
    } else if (e.key === ' ' && state.runtime.timer?.paused) {
      e.preventDefault();
      togglePause();
    }
  };
  window.addEventListener('keydown', pauseKeyHandler);
  state.runtime._cleanupPauseHandler = () => window.removeEventListener('keydown', pauseKeyHandler);

  const readAloudBtn = getElement('read-aloud-btn');
  if (readAloudBtn) {
    if (!isSpeechAvailable()) {
      if (readAloudBtn instanceof HTMLButtonElement) readAloudBtn.disabled = true;
      readAloudBtn.title = 'Text-to-speech not available in this browser';
    } else {
      readAloudBtn.addEventListener('click', () => {
        if (isSpeaking()) {
          stopSpeaking();
          readAloudBtn.textContent = '🔊 Read Aloud';
          readAloudBtn.classList.remove('speaking');
        } else if (state.runtime.targetText) {
          readAloudBtn.textContent = '⏹️ Stop';
          readAloudBtn.classList.add('speaking');
          speakText(
            state.runtime.targetText,
            () => {
              readAloudBtn.textContent = '🔊 Read Aloud';
              readAloudBtn.classList.remove('speaking');
            },
            null,
            { gender: state.settings.voiceGender, speed: state.settings.voiceSpeed },
          );
        }
      });
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
      const timerEndCallback = (finalInput: string) => {
        debouncedSaveDraft.cancel();
        clearDraft();
        endSession(finalInput, state, DATA, showScreen, persist);
      };

      if (state.runtime.flags?.countdownTimer && state.runtime.timer) {
        state.runtime.timer.remaining--;
        if (chip) chip.textContent = formatClock(state.runtime.timer.remaining);
        if (state.runtime.timer.remaining <= 0) {
          if (state.runtime.timer.handle) clearInterval(state.runtime.timer.handle);
          const inputEl = getElement<HTMLTextAreaElement>('typing-input');
          timerEndCallback(inputEl ? inputEl.value : '');
        }
      } else if (chip && state.runtime.startTime) {
        chip.textContent = formatClock(Math.floor((Date.now() - state.runtime.startTime.getTime()) / 1000));
      }
    };
  }
}

function bindSummaryEvents(): void {
  const replayBtn = getElement('replay-btn');
  replayBtn?.addEventListener('click', () => {
    if (state.runtime.lesson) startLesson(state.runtime.lesson);
  });
  getElement('start-drill-btn')?.addEventListener('click', () => startFocusDrill(state, DATA, showScreen, persist));
  getElement('home-btn')?.addEventListener('click', () => showScreen('home'));

  const results = state.runtime.summaryResults;
  const shouldConfetti = Boolean(
    results && (
      (results.newBadges?.length ?? 0) > 0
      || results.accuracy >= 95
      || (results.personalBest && (results.netWPM > results.personalBest.netWPM || results.accuracy > results.personalBest.accuracy))
    ),
  );
  if (shouldConfetti && !state.settings.reduceMotion) {
    triggerConfetti();
  }

  const summaryKeyHandler = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && replayBtn && !state.runtime.summaryResults?.isDrill && state.runtime.lesson) {
      startLesson(state.runtime.lesson);
    } else if (e.key === 'Escape') {
      showScreen('home');
    }
  };
  window.addEventListener('keydown', summaryKeyHandler);
  state.runtime._cleanupSummaryKeys = () => window.removeEventListener('keydown', summaryKeyHandler);
}

function bindScreenEvents(screenName: ScreenName): void {
  if (screenName === 'home') bindHomeEvents();
  if (screenName === 'typing') bindTypingEvents();
  if (screenName === 'summary') bindSummaryEvents();
}

function bindLessonPickerEvents(): void {
  const modalContainer = getElement('modal-container');
  if (!modalContainer) return;
  const stageFilter = modalContainer.querySelector('.stage-filter');
  const searchInput = getElement<HTMLInputElement>('search-input');
  const sortSelect = getElement<HTMLSelectElement>('sort-select');
  const statusFilter = getElement<HTMLSelectElement>('status-filter');
  const lessonListEl = modalContainer.querySelector('.lesson-list');
  if (!(stageFilter instanceof HTMLElement) || !searchInput || !sortSelect || !statusFilter || !(lessonListEl instanceof HTMLElement)) return;

  const setStageFilterDisabled = (type: string) => {
    const isPhonics = type === 'phonics';
    stageFilter.classList.toggle('disabled', isPhonics);
    stageFilter.querySelectorAll('button').forEach((btn) => {
      btn.disabled = isPhonics;
    });
  };

  const handleFilterChange = async (updates: Parameters<typeof updateLessonPicker>[0]) => {
    lessonListEl.classList.add('loading');
    if (updates.currentStage) await loadStageData(updates.currentStage);
    setTimeout(() => updateLessonPicker(updates, state, DATA), 50);
  };

  modalContainer.querySelectorAll('.tab-button').forEach((b) => b.addEventListener('click', (e) => {
    modalContainer.querySelector('.tab-button.active')?.classList.remove('active');
    if (e.currentTarget instanceof HTMLElement) e.currentTarget.classList.add('active');
    const newType = e.currentTarget instanceof HTMLElement ? e.currentTarget.dataset.type : undefined;
    if (!newType || !isLessonType(newType)) return;
    setStageFilterDisabled(newType);
    void handleFilterChange({ currentType: newType, currentPage: 1 });
  }));

  stageFilter.querySelectorAll('[data-stage]').forEach((b) => b.addEventListener('click', (e) => {
    const button = e.target instanceof Element ? e.target.closest('[data-stage]') : null;
    if (!(button instanceof HTMLButtonElement) || button.disabled) return;
    const clickedStage = button.dataset.stage;
    if (!clickedStage) return;
    const currentActive = stageFilter.querySelector('.active');
    if (currentActive instanceof HTMLElement && currentActive.dataset.stage === clickedStage) return;
    currentActive?.classList.remove('active');
    button.classList.add('active');
    void handleFilterChange({ currentStage: clickedStage, currentPage: 1 });
  }));

  searchInput.addEventListener('input', debounce(() => {
    void handleFilterChange({ searchTerm: searchInput.value, currentPage: 1 });
  }, 300));
  sortSelect.addEventListener('change', () => {
    const value = sortSelect.value;
    if (value === 'title' || value === 'length' || value === 'theme') {
      void handleFilterChange({ sortKey: value, currentPage: 1 });
    }
  });
  statusFilter.addEventListener('change', () => {
    const value = statusFilter.value;
    if (value === 'all' || value === 'complete' || value === 'todo') {
      void handleFilterChange({ statusFilter: value, currentPage: 1 });
    }
  });

  lessonListEl.addEventListener('click', (e) => {
    const startBtn = e.target instanceof Element ? e.target.closest('[data-start]') : null;
    if (!startBtn) return;
    const item = startBtn.closest('.lesson-item');
    if (!(item instanceof HTMLElement)) return;
    const { id, type } = item.dataset;
    if (!id || !type) return;
    const lessonData = findLesson(type, id);
    if (lessonData && isLessonType(type)) {
      closeModal();
      startLesson({ type, data: lessonData });
    }
  });

  modalContainer.querySelector('.pagination-controls')?.addEventListener('click', (e) => {
    const action = e.target instanceof HTMLElement ? e.target.dataset.action : undefined;
    if (action) handleLessonPickerPagination(action);
  });

  stageFilter.querySelector(`[data-stage="${state.settings.defaultStage}"]`)?.classList.add('active');
  const pickerState = getLessonPickerState();
  setStageFilterDisabled(pickerState.currentType);
  void handleFilterChange({ currentStage: pickerState.currentStage });
}

function bindSettingsEvents(): void {
  const s = state.settings;
  const setVal = (id: string, value: string | number | boolean) => {
    const el = getElement(id);
    if (el instanceof HTMLInputElement) {
      if (el.type === 'checkbox') el.checked = Boolean(value);
      else el.value = String(value);
    } else if (el instanceof HTMLSelectElement) {
      el.value = String(value);
    }
  };
  setVal('setting-theme', s.theme);
  setVal('setting-font', s.font);
  setVal('setting-line-height', s.lineHeight);
  setVal('setting-letter-spacing', s.letterSpacing);
  setVal('setting-lockstep', s.lockstepDefault);
  setVal('setting-focusline', s.focusLineDefault);
  setVal('setting-keyboard', s.keyboardHintDefault);
  setVal('setting-timer-display', s.showTimerDisplay);
  setVal('setting-sound', s.soundEnabled);
  setVal('setting-finger-guide', s.fingerGuide);
  setVal('setting-reduce-motion', s.reduceMotion);
  setVal('setting-voice-gender', s.voiceGender);
  setVal('setting-voice-speed', s.voiceSpeed);
  setVal('setting-default-stage', s.defaultStage);
  const lhVal = getElement('lh-val');
  const lsVal = getElement('ls-val');
  const vsVal = getElement('vs-val');
  if (lhVal) lhVal.textContent = String(s.lineHeight);
  if (lsVal) lsVal.textContent = `+${s.letterSpacing}%`;
  if (vsVal) vsVal.textContent = `${Math.round((s.voiceSpeed ?? 0.85) * 100)}%`;

  getElement<HTMLInputElement>('setting-line-height')?.addEventListener('input', (e) => {
    if (lhVal && e.target instanceof HTMLInputElement) lhVal.textContent = e.target.value;
  });
  getElement<HTMLInputElement>('setting-letter-spacing')?.addEventListener('input', (e) => {
    if (lsVal && e.target instanceof HTMLInputElement) lsVal.textContent = `+${e.target.value}%`;
  });
  getElement<HTMLInputElement>('setting-voice-speed')?.addEventListener('input', (e) => {
    if (vsVal && e.target instanceof HTMLInputElement) vsVal.textContent = `${Math.round(Number(e.target.value) * 100)}%`;
  });

  getElement('save-settings-btn')?.addEventListener('click', async () => {
    const theme = getElement<HTMLSelectElement>('setting-theme')?.value;
    const font = getElement<HTMLSelectElement>('setting-font')?.value;
    const stage = getElement<HTMLSelectElement>('setting-default-stage')?.value;
    const voice = getElement<HTMLSelectElement>('setting-voice-gender')?.value;
    if (theme === 'cream' || theme === 'light' || theme === 'dark') s.theme = theme as ThemeName;
    if (font === 'default' || font === 'dyslexia' || font === 'opendyslexic') s.font = font as FontName;
    if (isStage(stage)) s.defaultStage = stage as Stage;
    if (voice === 'female' || voice === 'male') s.voiceGender = voice as VoiceGender;
    s.lineHeight = parseFloat(getElement<HTMLInputElement>('setting-line-height')?.value ?? '') || 1.7;
    s.letterSpacing = parseInt(getElement<HTMLInputElement>('setting-letter-spacing')?.value ?? '', 10);
    if (Number.isNaN(s.letterSpacing)) s.letterSpacing = 2;
    s.lockstepDefault = Boolean(getElement<HTMLInputElement>('setting-lockstep')?.checked);
    s.focusLineDefault = Boolean(getElement<HTMLInputElement>('setting-focusline')?.checked);
    s.keyboardHintDefault = Boolean(getElement<HTMLInputElement>('setting-keyboard')?.checked);
    s.showTimerDisplay = Boolean(getElement<HTMLInputElement>('setting-timer-display')?.checked);
    s.soundEnabled = Boolean(getElement<HTMLInputElement>('setting-sound')?.checked);
    s.fingerGuide = Boolean(getElement<HTMLInputElement>('setting-finger-guide')?.checked);
    s.reduceMotion = Boolean(getElement<HTMLInputElement>('setting-reduce-motion')?.checked);
    s.voiceSpeed = parseFloat(getElement<HTMLInputElement>('setting-voice-speed')?.value ?? '');
    if (Number.isNaN(s.voiceSpeed)) s.voiceSpeed = 0.85;

    const newPin = getElement<HTMLInputElement>('setting-pin')?.value ?? '';
    if (/^\d{4}$/.test(newPin)) s.pin = await sha256Hex(newPin);

    applySettings(s, state.progress);
    persist();
    closeModal();
  });
}

function bindModalEvents(modalName: ModalName): void {
  const modalContainer = getElement('modal-container');
  const modalEl = modalContainer?.querySelector('.modal');
  const contentEl = modalEl?.querySelector('.modal-content');
  if (!(modalEl instanceof HTMLElement) || !(contentEl instanceof HTMLElement)) return;

  modalEl.querySelector('#close-modal-btn')?.addEventListener('click', () => closeModal());
  modalEl.addEventListener('click', (e) => { if (e.target === modalEl) closeModal(); });

  const focusables = Array.from(contentEl.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'));
  if (focusables.length > 0) {
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    contentEl.addEventListener('keydown', (e) => {
      if (e.key !== 'Tab' || !first || !last) return;
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
  }

  if (modalName === 'lessonPicker') bindLessonPickerEvents();
  if (modalName === 'welcome') getElement('welcome-start-btn')?.addEventListener('click', () => closeModal());
  if (modalName === 'settings') bindSettingsEvents();
  if (modalName === 'parent') {
    getElement('export-btn')?.addEventListener('click', () => {
      const timestamp = new Date().toISOString().slice(0, 16).replace(/[T:]/g, '-');
      const dataStr = JSON.stringify({ _v: SCHEMA_VERSION, appVersion: APP_VERSION, state }, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `storykeys-backup-${timestamp}.json`;
      a.click();
      URL.revokeObjectURL(url);
    });
    getElement('clear-data-btn')?.addEventListener('click', () => {
      if (confirm('Really clear all progress? This cannot be undone.')) {
        clearAllStoredData();
        location.reload();
      }
    });
  }
  if (modalName === 'badges') {
    getElement('print-certificate-btn')?.addEventListener('click', () => printCertificate(state, DATA));
  }
  if (modalName === 'pin') {
    const pinInput = getElement<HTMLInputElement>('pin-input');
    const submit = async () => {
      const value = pinInput?.value ?? '';
      const ok = Boolean(state.settings.pin && await sha256Hex(value) === state.settings.pin);
      if (ok) {
        closeModal();
        showModal('parent');
      } else {
        alert('Incorrect PIN.');
        if (pinInput) {
          pinInput.value = '';
          pinInput.focus();
        }
      }
    };
    pinInput?.addEventListener('input', () => { if (pinInput.value.length === 4) void submit(); });
    getElement('pin-submit-btn')?.addEventListener('click', () => { void submit(); });
  }
}

async function init(): Promise<void> {
  const loadingOverlay = getElement('loading-overlay');
  const appContainer = getElement('app-container');
  const errorEl = getElement('loading-error');

  try {
    await loadInitialData();
    loadState(state);

    if (!localStorage.getItem(STATE_KEY)) {
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        state.settings.theme = 'dark';
      }
    }

    applySettings(state.settings, state.progress);
    showScreen('home');
    bindAppEvents();

    if (shouldShowWelcome(state)) {
      showModal('welcome');
    }

    if (loadingOverlay) loadingOverlay.style.opacity = '0';
    appContainer?.classList.remove('hidden');
    setTimeout(() => { if (loadingOverlay) loadingOverlay.style.display = 'none'; }, 300);
  } catch (error) {
    console.error('Initialization failed:', error);
    if (errorEl) {
      errorEl.textContent = 'Data failed to load. Please check your connection and refresh the page.';
      errorEl.classList.remove('hidden');
    }
  }
}

document.addEventListener('DOMContentLoaded', () => { void init(); });
