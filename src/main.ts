import { stopSpeaking } from './audio/sounds';
import { STATE_KEY } from './config';
import { createLesson, DATA, ensureLessonLoaded, loadInitialData, loadStageData } from './data/loader';
import { clearDraft, loadDraft } from './draft';
import { pickFreshLesson, startFocusDrill, startSession, teardownRuntime } from './session/lessons';
import { mountTypingScreen, saveCurrentTypingDraft } from './session/typingController';
import { createInitialState, loadState, saveState, shouldShowWelcome } from './state';
import type { AppState, Lesson, ModalName, ScreenName } from './types';
import { isLessonType } from './types';
import { applySettings, toast, triggerConfetti } from './ui/feedback';
import { closeModal, showModal, type ModalContext, type ShowModalOptions } from './ui/modalController';
import { getScreenHtml } from './ui/screens';
import { getElement } from './utils';

const state: AppState = createInitialState();

function persist(): void {
  saveState(state);
}

function startLesson(lesson: Lesson): void {
  startSession(lesson, state, showScreen, persist);
}

const modalCtx: ModalContext = {
  state,
  data: DATA,
  persist,
  startLesson,
};

function openModal(modalName: ModalName, options?: ShowModalOptions): void {
  showModal(modalName, modalCtx, options);
}

function leaveTypingScreen(): void {
  saveCurrentTypingDraft(state);
  showScreen('home');
}

function showScreen(screenName: ScreenName): void {
  teardownRuntime(state.runtime);
  stopSpeaking();
  state.ui.currentScreen = screenName;
  const mainContent = getElement('main-content');
  if (!mainContent) return;
  const draft = screenName === 'home' ? loadDraft() : null;
  mainContent.innerHTML = getScreenHtml(screenName, state, DATA, draft);
  bindScreenEvents(screenName);
  window.scrollTo(0, 0);
}

function bindAppEvents(): void {
  getElement('about-btn')?.addEventListener('click', () => {
    closeModal(state, persist);
    if (state.ui.currentScreen === 'typing') {
      leaveTypingScreen();
      return;
    }
    showScreen('home');
  });
  getElement('help-btn')?.addEventListener('click', () => openModal('help'));
  getElement('start-here-btn')?.addEventListener('click', () => openModal('welcome'));
  getElement('settings-btn')?.addEventListener('click', () => openModal('settings'));
  getElement('parent-btn')?.addEventListener('click', () => {
    if (state.settings.pin) openModal('pin');
    else openModal('parent');
  });
  getElement('footer-privacy-link')?.addEventListener('click', () => {
    openModal('help', { scrollToId: 'help-data-privacy' });
  });
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && state.ui.modal) {
      e.preventDefault();
      closeModal(state, persist);
    }
  });
}

function bindHomeEvents(): void {
  getElement('resume-draft-btn')?.addEventListener('click', () => {
    const draft = loadDraft();
    if (draft?.lessonData && isLessonType(draft.lessonType)) {
      const lesson = createLesson(draft.lessonType, draft.lessonData);
      if (lesson) {
        startSession(lesson, state, showScreen, persist, { resumedTypedText: draft.typedText });
      }
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
      const lessonData = pickFreshLesson(DATA.PASSAGES.filter((p) => p.stage === stage), 'passage', state);
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
      const lessonData = pickFreshLesson(stageSpellings, 'spelling', state);
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
    const lessonData = pickFreshLesson(DATA.PHONICS, 'phonics', state);
    if (!lessonData) {
      toast('No phonics passages available yet. Please try again later.');
      return;
    }
    startLesson({ type: 'phonics', data: lessonData });
  });

  getElement('browse-lessons-btn')?.addEventListener('click', () => openModal('lessonPicker'));
  getElement('view-badges-btn')?.addEventListener('click', () => openModal('badges'));

  document.querySelector('.recent-lessons-list')?.addEventListener('click', async (e) => {
    const btn = e.target instanceof Element ? e.target.closest('.recent-lesson-btn') : null;
    if (!(btn instanceof HTMLElement)) return;
    const id = btn.dataset.recentId;
    const type = btn.dataset.recentType;
    const stage = btn.dataset.recentStage;
    if (!id || !type || !isLessonType(type)) return;
    const lessonData = await ensureLessonLoaded(type, id, stage);
    const lesson = lessonData ? createLesson(type, lessonData) : null;
    if (lesson) {
      startLesson(lesson);
    } else {
      toast('Could not find that lesson. It may have been removed.');
    }
  });
}

function bindSummaryEvents(): void {
  const controller = new AbortController();
  state.runtime.abortController = controller;
  const { signal } = controller;

  const replayBtn = getElement('replay-btn');
  replayBtn?.addEventListener('click', () => {
    if (state.runtime.lesson) startLesson(state.runtime.lesson);
  }, { signal });

  getElement('start-drill-btn')?.addEventListener('click', () => {
    void startFocusDrill(state, DATA, showScreen, persist);
  }, { signal });

  getElement('home-btn')?.addEventListener('click', () => showScreen('home'), { signal });

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

  window.addEventListener('keydown', (e: KeyboardEvent) => {
    if (state.ui.modal) return;
    if (e.key === 'Enter' && replayBtn && !state.runtime.summaryResults?.isDrill && state.runtime.lesson) {
      startLesson(state.runtime.lesson);
    } else if (e.key === 'Escape') {
      showScreen('home');
    }
  }, { signal });
}

function bindScreenEvents(screenName: ScreenName): void {
  if (screenName === 'home') bindHomeEvents();
  if (screenName === 'typing') {
    mountTypingScreen({
      state,
      data: DATA,
      showScreen,
      persist,
      onRequestExit: leaveTypingScreen,
    });
  }
  if (screenName === 'summary') bindSummaryEvents();
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
      openModal('welcome');
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
