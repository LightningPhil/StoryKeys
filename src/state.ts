import { config, CURRENT_WELCOME_VERSION, SCHEMA_VERSION, STATE_KEY } from './config';
import type {
  AppState,
  FontName,
  LessonPickerState,
  Meta,
  PersistedState,
  Progress,
  Settings,
  Stage,
  ThemeName,
  VoiceGender,
} from './types';
import { isLessonKey } from './types';

export const DEFAULT_META: Meta = {
  hasSeenWelcome: false,
  welcomeVersion: CURRENT_WELCOME_VERSION,
  lastLessonId: null,
};

export const DEFAULT_SETTINGS: Settings = {
  font: 'default',
  lineHeight: 1.7,
  letterSpacing: 2,
  theme: 'cream',
  lockstepDefault: true,
  focusLineDefault: true,
  keyboardHintDefault: false,
  showTimerDisplay: true,
  defaultStage: 'KS2',
  pin: null,
  soundEnabled: false,
  fingerGuide: false,
  reduceMotion: false,
  voiceGender: 'female',
  voiceSpeed: 0.85,
};

export const DEFAULT_PROGRESS: Progress = {
  minutesTotal: 0,
  wordsTotal: 0,
  badges: [],
  themesCompleted: {},
  stagesCompleted: {},
  lastPlayed: null,
  consecutiveDays: 0,
  completedPassages: [],
  completedSpellings: [],
  completedPhonics: [],
  completedWordsets: [],
};

export function createInitialPickerState(defaultStage: string = DEFAULT_SETTINGS.defaultStage): LessonPickerState {
  return {
    searchTerm: '',
    sortKey: config.DEFAULT_SORT_KEY,
    statusFilter: 'all',
    currentPage: 1,
    currentType: 'passage',
    currentStage: defaultStage,
    totalPages: 1,
    hasAutoScrolled: false,
  };
}

export function createInitialState(): AppState {
  return {
    settings: { ...DEFAULT_SETTINGS },
    progress: {
      ...DEFAULT_PROGRESS,
      badges: [],
      themesCompleted: {},
      stagesCompleted: {},
      completedPassages: [],
      completedSpellings: [],
      completedPhonics: [],
      completedWordsets: [],
    },
    sessions: [],
    meta: { ...DEFAULT_META },
    ui: {
      currentScreen: 'home',
      modal: null,
      lastFocus: null,
      picker: createInitialPickerState(DEFAULT_SETTINGS.defaultStage),
    },
    runtime: {},
  };
}

function isTheme(value: unknown): value is ThemeName {
  return value === 'cream' || value === 'light' || value === 'dark';
}

function isFont(value: unknown): value is FontName {
  return value === 'default' || value === 'dyslexia' || value === 'opendyslexic';
}

function isStageValue(value: unknown): value is Stage {
  return value === 'KS1' || value === 'KS2' || value === 'KS3' || value === 'KS4';
}

function isVoiceGender(value: unknown): value is VoiceGender {
  return value === 'female' || value === 'male';
}

export function sanitiseSettings(base: Settings, incoming?: Partial<Record<keyof Settings, unknown>>): Settings {
  const merged = { ...base, ...(incoming ?? {}) } as Record<keyof Settings, unknown>;
  const lineHeight = parseFloat(String(merged.lineHeight));
  const letterSpacing = parseInt(String(merged.letterSpacing), 10);
  const voiceSpeed = parseFloat(String(merged.voiceSpeed));

  return {
    theme: isTheme(merged.theme) ? merged.theme : DEFAULT_SETTINGS.theme,
    font: isFont(merged.font) ? merged.font : DEFAULT_SETTINGS.font,
    defaultStage: isStageValue(merged.defaultStage) ? merged.defaultStage : DEFAULT_SETTINGS.defaultStage,
    voiceGender: isVoiceGender(merged.voiceGender) ? merged.voiceGender : DEFAULT_SETTINGS.voiceGender,
    lineHeight: Number.isFinite(lineHeight) && lineHeight > 0 ? lineHeight : DEFAULT_SETTINGS.lineHeight,
    letterSpacing: Number.isNaN(letterSpacing) ? DEFAULT_SETTINGS.letterSpacing : letterSpacing,
    voiceSpeed: Number.isNaN(voiceSpeed) ? DEFAULT_SETTINGS.voiceSpeed : voiceSpeed,
    lockstepDefault: Boolean(merged.lockstepDefault),
    focusLineDefault: Boolean(merged.focusLineDefault),
    keyboardHintDefault: Boolean(merged.keyboardHintDefault),
    showTimerDisplay: Boolean(merged.showTimerDisplay),
    soundEnabled: Boolean(merged.soundEnabled),
    fingerGuide: Boolean(merged.fingerGuide),
    reduceMotion: Boolean(merged.reduceMotion),
    pin: typeof merged.pin === 'string' || merged.pin === null ? merged.pin : base.pin,
  };
}

export function saveState(state: AppState): void {
  try {
    const persisted: PersistedState = {
      _v: SCHEMA_VERSION,
      settings: state.settings,
      progress: state.progress,
      sessions: state.sessions,
      meta: state.meta,
    };
    localStorage.setItem(STATE_KEY, JSON.stringify(persisted));
  } catch (e) {
    console.warn('Unable to save state to localStorage:', e);
  }
}

export function loadState(state: AppState): void {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as PersistedState;
    state.settings = sanitiseSettings(state.settings, parsed.settings);
    state.ui.picker.currentStage = state.settings.defaultStage;
    state.progress = {
      ...state.progress,
      ...parsed.progress,
      completedPassages: parsed.progress?.completedPassages || [],
      completedSpellings: parsed.progress?.completedSpellings || [],
      completedPhonics: parsed.progress?.completedPhonics || [],
      completedWordsets: parsed.progress?.completedWordsets || [],
      badges: parsed.progress?.badges || [],
      themesCompleted: parsed.progress?.themesCompleted || {},
      stagesCompleted: parsed.progress?.stagesCompleted || {},
    };
    state.sessions = parsed.sessions || [];
    const parsedLastId = parsed.meta?.lastLessonId;
    state.meta = {
      hasSeenWelcome: Boolean(parsed.meta?.hasSeenWelcome),
      welcomeVersion: typeof parsed.meta?.welcomeVersion === 'number'
        ? parsed.meta.welcomeVersion
        : DEFAULT_META.welcomeVersion,
      lastLessonId: isLessonKey(parsedLastId) ? parsedLastId : null,
    };
  } catch (e) {
    console.error('Failed to parse state from localStorage:', e);
  }
}

export function markWelcomeSeen(state: AppState, persist: () => void): void {
  state.meta.hasSeenWelcome = true;
  state.meta.welcomeVersion = CURRENT_WELCOME_VERSION;
  persist();
}

export function shouldShowWelcome(state: AppState): boolean {
  return !state.meta.hasSeenWelcome || state.meta.welcomeVersion !== CURRENT_WELCOME_VERSION;
}
