import { CURRENT_WELCOME_VERSION, SCHEMA_VERSION } from './config';
import { STATE_KEY } from './draft';
import type {
  AppState,
  FontName,
  Meta,
  PersistedState,
  Progress,
  Settings,
  Stage,
  ThemeName,
  VoiceGender,
} from './types';

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
    ui: { currentScreen: 'home', modal: null, lastFocus: null },
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
    state.settings = { ...state.settings, ...parsed.settings };
    if (!isTheme(state.settings.theme)) state.settings.theme = DEFAULT_SETTINGS.theme;
    if (!isFont(state.settings.font)) state.settings.font = DEFAULT_SETTINGS.font;
    if (!isStageValue(state.settings.defaultStage)) state.settings.defaultStage = DEFAULT_SETTINGS.defaultStage;
    if (!isVoiceGender(state.settings.voiceGender)) state.settings.voiceGender = DEFAULT_SETTINGS.voiceGender;
    state.settings.lineHeight = parseFloat(String(state.settings.lineHeight)) || 1.7;
    state.settings.letterSpacing = parseInt(String(state.settings.letterSpacing), 10);
    if (Number.isNaN(state.settings.letterSpacing)) state.settings.letterSpacing = 2;
    state.settings.voiceSpeed = parseFloat(String(state.settings.voiceSpeed));
    if (Number.isNaN(state.settings.voiceSpeed)) state.settings.voiceSpeed = 0.85;
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
    state.meta = { ...DEFAULT_META, ...(parsed.meta || {}) };
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
