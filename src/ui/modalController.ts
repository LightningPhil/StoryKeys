import { APP_VERSION, SCHEMA_VERSION } from '../config';
import { createLesson, findLesson, loadStageData } from '../data/loader';
import { clearAllStoredData } from '../draft';
import { calculateVisualLines } from '../session/keyboard';
import { markWelcomeSeen, sanitiseSettings } from '../state';
import type { AppData, AppState, Lesson, ModalName, PersistStateFn } from '../types';
import { isLessonType } from '../types';
import { debounce, getElement, sha256Hex } from '../utils';
import { applySettings, printCertificate, toast } from './feedback';
import { getModalHtml } from './modals';
import { handleLessonPickerPagination, resetLessonPickerState, updateLessonPicker } from './picker';

export interface ModalContext {
  state: AppState;
  data: AppData;
  persist: PersistStateFn;
  startLesson: (lesson: Lesson) => void;
}

export interface ShowModalOptions {
  scrollToId?: string;
}

const FOCUSABLE_SELECTOR = [
  'button:not(:disabled)',
  '[href]',
  'input:not(:disabled)',
  'select:not(:disabled)',
  'textarea:not(:disabled)',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

let modalCloseTimer: ReturnType<typeof setTimeout> | null = null;
let modalAbortController: AbortController | null = null;

function isElementVisible(el: HTMLElement): boolean {
  return !el.closest('[hidden]') && el.getClientRects().length > 0;
}

export function closeModal(state: AppState, persist: PersistStateFn): void {
  modalAbortController?.abort();
  modalAbortController = null;

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

export function showModal(
  modalName: ModalName,
  ctx: ModalContext,
  options: ShowModalOptions = {},
): void {
  const { state, data } = ctx;
  if (modalCloseTimer) {
    clearTimeout(modalCloseTimer);
    modalCloseTimer = null;
  }
  modalAbortController?.abort();
  modalAbortController = new AbortController();

  if (!state.ui.modal) {
    state.ui.lastFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  }
  state.ui.modal = modalName;
  const modalContainer = getElement('modal-container');
  if (!modalContainer) return;
  modalContainer.innerHTML = getModalHtml(modalName, state, data);

  if (modalName === 'lessonPicker') {
    resetLessonPickerState(state);
  }

  document.body.classList.add('modal-open');
  const modal = modalContainer.querySelector('.modal');
  if (!(modal instanceof HTMLElement)) return;
  bindModalEvents(modalName, ctx, modalAbortController.signal);
  modal.classList.add('active');

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

function bindLessonPickerEvents(ctx: ModalContext, signal: AbortSignal): void {
  const { state, data, persist, startLesson } = ctx;
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

  let requestSeq = 0;
  const handleFilterChange = async (updates: Parameters<typeof updateLessonPicker>[0]) => {
    const seq = ++requestSeq;
    lessonListEl.classList.add('loading');
    if (updates.currentStage) await loadStageData(updates.currentStage);
    if (signal.aborted || seq !== requestSeq) return;
    updateLessonPicker(updates, state, data);
  };

  modalContainer.querySelectorAll('.tab-button').forEach((b) => b.addEventListener('click', (e) => {
    modalContainer.querySelector('.tab-button.active')?.classList.remove('active');
    if (e.currentTarget instanceof HTMLElement) e.currentTarget.classList.add('active');
    const newType = e.currentTarget instanceof HTMLElement ? e.currentTarget.dataset.type : undefined;
    if (!newType || !isLessonType(newType)) return;
    setStageFilterDisabled(newType);
    void handleFilterChange({ currentType: newType, currentPage: 1 });
  }, { signal }));

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
  }, { signal }));

  const debouncedSearch = debounce(() => {
    void handleFilterChange({ searchTerm: searchInput.value, currentPage: 1 });
  }, 300);
  signal.addEventListener('abort', () => debouncedSearch.cancel());
  searchInput.addEventListener('input', debouncedSearch, { signal });

  sortSelect.addEventListener('change', () => {
    const value = sortSelect.value;
    if (value === 'title' || value === 'length' || value === 'theme') {
      void handleFilterChange({ sortKey: value, currentPage: 1 });
    }
  }, { signal });

  statusFilter.addEventListener('change', () => {
    const value = statusFilter.value;
    if (value === 'all' || value === 'complete' || value === 'todo') {
      void handleFilterChange({ statusFilter: value, currentPage: 1 });
    }
  }, { signal });

  lessonListEl.addEventListener('click', (e) => {
    const startBtn = e.target instanceof Element ? e.target.closest('[data-start]') : null;
    if (!startBtn) return;
    const item = startBtn.closest('.lesson-item');
    if (!(item instanceof HTMLElement)) return;
    const { id, type } = item.dataset;
    if (!id || !type || !isLessonType(type)) return;
    const lessonData = findLesson(type, id);
    const lesson = lessonData ? createLesson(type, lessonData) : null;
    if (lesson) {
      closeModal(state, persist);
      startLesson(lesson);
    }
  }, { signal });

  modalContainer.querySelector('.pagination-controls')?.addEventListener('click', (e) => {
    const action = e.target instanceof HTMLElement ? e.target.dataset.action : undefined;
    if (action) handleLessonPickerPagination(action, state, data);
  }, { signal });

  stageFilter.querySelector(`[data-stage="${state.settings.defaultStage}"]`)?.classList.add('active');
  const pickerState = state.ui.picker;
  setStageFilterDisabled(pickerState.currentType);
  void handleFilterChange({ currentStage: pickerState.currentStage });
}

function bindSettingsEvents(ctx: ModalContext, signal: AbortSignal): void {
  const { state, data, persist } = ctx;
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
  }, { signal });
  getElement<HTMLInputElement>('setting-letter-spacing')?.addEventListener('input', (e) => {
    if (lsVal && e.target instanceof HTMLInputElement) lsVal.textContent = `+${e.target.value}%`;
  }, { signal });
  getElement<HTMLInputElement>('setting-voice-speed')?.addEventListener('input', (e) => {
    if (vsVal && e.target instanceof HTMLInputElement) vsVal.textContent = `${Math.round(Number(e.target.value) * 100)}%`;
  }, { signal });

  const pinErrorEl = getElement('setting-pin-error');
  const showPinError = (msg: string) => {
    if (!pinErrorEl) return;
    pinErrorEl.textContent = msg;
    pinErrorEl.classList.toggle('hidden', !msg);
  };

  let clearPinRequested = false;
  const clearPinBtn = getElement('clear-pin-btn');
  clearPinBtn?.addEventListener('click', () => {
    clearPinRequested = true;
    showPinError('');
    const statusText = getElement('setting-pin-status');
    if (statusText) statusText.textContent = 'PIN will be removed when you enter current PIN and save.';
    getElement<HTMLInputElement>('setting-current-pin')?.focus();
  }, { signal });

  getElement('save-settings-btn')?.addEventListener('click', async () => {
    showPinError('');
    const updated = sanitiseSettings(state.settings, {
      theme: getElement<HTMLSelectElement>('setting-theme')?.value,
      font: getElement<HTMLSelectElement>('setting-font')?.value,
      defaultStage: getElement<HTMLSelectElement>('setting-default-stage')?.value,
      voiceGender: getElement<HTMLSelectElement>('setting-voice-gender')?.value,
      lineHeight: getElement<HTMLInputElement>('setting-line-height')?.value,
      letterSpacing: getElement<HTMLInputElement>('setting-letter-spacing')?.value,
      lockstepDefault: getElement<HTMLInputElement>('setting-lockstep')?.checked,
      focusLineDefault: getElement<HTMLInputElement>('setting-focusline')?.checked,
      keyboardHintDefault: getElement<HTMLInputElement>('setting-keyboard')?.checked,
      showTimerDisplay: getElement<HTMLInputElement>('setting-timer-display')?.checked,
      soundEnabled: getElement<HTMLInputElement>('setting-sound')?.checked,
      fingerGuide: getElement<HTMLInputElement>('setting-finger-guide')?.checked,
      reduceMotion: getElement<HTMLInputElement>('setting-reduce-motion')?.checked,
      voiceSpeed: getElement<HTMLInputElement>('setting-voice-speed')?.value,
    });

    const currentPinInput = getElement<HTMLInputElement>('setting-current-pin')?.value ?? '';
    const newPin = getElement<HTMLInputElement>('setting-pin')?.value ?? '';
    const hasExistingPin = Boolean(state.settings.pin);

    if (clearPinRequested && hasExistingPin) {
      const verified = Boolean(currentPinInput && await sha256Hex(currentPinInput) === state.settings.pin);
      if (!verified) {
        showPinError('Enter your current 4-digit PIN to remove it.');
        return;
      }
      updated.pin = null;
      toast('Parent PIN removed.');
    } else if (newPin.length > 0) {
      if (!/^\d{4}$/.test(newPin)) {
        showPinError('New PIN must be exactly 4 digits.');
        return;
      }
      if (hasExistingPin) {
        const verified = Boolean(currentPinInput && await sha256Hex(currentPinInput) === state.settings.pin);
        if (!verified) {
          showPinError('Enter your current 4-digit PIN before setting a new one.');
          return;
        }
      }
      updated.pin = await sha256Hex(newPin);
    }

    state.settings = updated;
    applySettings(state.settings, state.progress);
    if (state.ui.currentScreen === 'typing') {
      if (typeof document !== 'undefined' && document.fonts) {
        void document.fonts.ready.then(() => {
          if (state.ui.currentScreen === 'typing') calculateVisualLines(state, data);
        });
      } else {
        calculateVisualLines(state, data);
      }
    }
    persist();
    closeModal(state, persist);
  }, { signal });
}

function bindParentEvents(ctx: ModalContext, signal: AbortSignal): void {
  const { state } = ctx;
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
  }, { signal });

  const clearBtn = getElement('clear-data-btn');
  const confirmPanel = getElement('clear-data-confirm');
  clearBtn?.addEventListener('click', () => {
    if (confirmPanel) {
      confirmPanel.classList.remove('hidden');
      getElement('confirm-clear-data-btn')?.focus();
      return;
    }
    if (confirm('Really clear all progress? This cannot be undone.')) {
      clearAllStoredData();
      location.reload();
    }
  }, { signal });

  getElement('cancel-clear-data-btn')?.addEventListener('click', () => {
    confirmPanel?.classList.add('hidden');
    clearBtn?.focus();
  }, { signal });

  getElement('confirm-clear-data-btn')?.addEventListener('click', () => {
    clearAllStoredData();
    location.reload();
  }, { signal });
}

function bindPinEvents(ctx: ModalContext, signal: AbortSignal): void {
  const { state } = ctx;
  const pinInput = getElement<HTMLInputElement>('pin-input');
  const errorEl = getElement('pin-error');
  const submit = async () => {
    const value = pinInput?.value ?? '';
    const ok = Boolean(state.settings.pin && await sha256Hex(value) === state.settings.pin);
    if (ok) {
      showModal('parent', ctx);
    } else {
      if (errorEl) {
        errorEl.textContent = 'Incorrect PIN. Please try again.';
        errorEl.classList.remove('hidden');
      }
      if (pinInput) {
        pinInput.value = '';
        pinInput.focus();
      }
    }
  };
  pinInput?.addEventListener('input', () => {
    errorEl?.classList.add('hidden');
    if (pinInput.value.length === 4) void submit();
  }, { signal });
  getElement('pin-submit-btn')?.addEventListener('click', () => { void submit(); }, { signal });
}

function bindModalEvents(modalName: ModalName, ctx: ModalContext, signal: AbortSignal): void {
  const { state, data, persist } = ctx;
  const modalContainer = getElement('modal-container');
  const modalEl = modalContainer?.querySelector('.modal');
  const contentEl = modalEl?.querySelector('.modal-content');
  if (!(modalEl instanceof HTMLElement) || !(contentEl instanceof HTMLElement)) return;

  modalEl.querySelector('#close-modal-btn')?.addEventListener('click', () => closeModal(state, persist), { signal });
  modalEl.addEventListener('click', (e) => {
    if (e.target === modalEl) closeModal(state, persist);
  }, { signal });

  // Query focusable controls dynamically on each Tab press so pagination and
  // disabled-state updates inside modals never leave detached focus bounds.
  contentEl.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return;
    const focusables = Array.from(contentEl.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
      .filter(isElementVisible);
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (!first || !last) return;
    if (e.shiftKey && (document.activeElement === first || document.activeElement === contentEl)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }, { signal });

  if (modalName === 'lessonPicker') bindLessonPickerEvents(ctx, signal);
  if (modalName === 'welcome') {
    getElement('welcome-start-btn')?.addEventListener('click', () => closeModal(state, persist), { signal });
  }
  if (modalName === 'settings') bindSettingsEvents(ctx, signal);
  if (modalName === 'parent') bindParentEvents(ctx, signal);
  if (modalName === 'badges') {
    getElement('print-certificate-btn')?.addEventListener('click', () => printCertificate(state, data), { signal });
  }
  if (modalName === 'pin') bindPinEvents(ctx, signal);
}
