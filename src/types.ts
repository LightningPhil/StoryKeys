export type Stage = 'KS1' | 'KS2' | 'KS3' | 'KS4';
export type LessonType = 'passage' | 'phonics' | 'spelling' | 'wordset' | 'drill';
export type ThemeName = 'cream' | 'light' | 'dark';
export type FontName = 'default' | 'dyslexia' | 'opendyslexic';
export type ScreenName = 'home' | 'typing' | 'summary';
export type ModalName = 'welcome' | 'help' | 'badges' | 'lessonPicker' | 'settings' | 'parent' | 'pin';
export type VoiceGender = 'female' | 'male';
export type StatusFilter = 'all' | 'complete' | 'todo';
export type SortKey = 'title' | 'length' | 'theme';
export type FingerZone = 'lp' | 'lr' | 'lm' | 'li' | 'ri' | 'rm' | 'rr' | 'rp' | 'thumb';

export type ContentId = string;
export type LessonKey = `${LessonType}:${string}:${string}`;

export const STAGES: readonly Stage[] = ['KS1', 'KS2', 'KS3', 'KS4'];

export function isStage(value: string | undefined): value is Stage {
  return value === 'KS1' || value === 'KS2' || value === 'KS3' || value === 'KS4';
}

export function isLessonType(value: string | undefined): value is LessonType {
  return value === 'passage' || value === 'phonics' || value === 'spelling' || value === 'wordset' || value === 'drill';
}

export function isLessonKey(value: unknown): value is LessonKey {
  if (typeof value !== 'string') return false;
  const parts = value.split(':');
  return parts.length >= 3 && isLessonType(parts[0]);
}

export interface ComplexityTags {
  caps?: boolean;
  punct?: boolean;
}

export interface LessonTags {
  complexity?: ComplexityTags;
  phonics?: string[];
}

export interface Passage {
  id: ContentId;
  stage?: string;
  theme?: string;
  title?: string;
  name?: string;
  text: string;
  tags?: LessonTags;
}

export interface Wordset {
  id: ContentId;
  stage?: string;
  theme?: string;
  name?: string;
  title?: string;
  words: string[];
  tags?: LessonTags;
}

export interface PatternPack {
  id: ContentId;
  stage?: string;
  theme?: string;
  name: string;
  items: string[];
  tags?: LessonTags;
}

export interface DrillData {
  id?: ContentId;
  name: string;
  words: string[];
  stage?: string;
  theme?: string;
  text?: string;
  tags?: LessonTags;
}

export type LessonData = Passage | Wordset | PatternPack | DrillData;

export type Lesson =
  | { type: 'passage'; data: Passage; withTimer?: boolean }
  | { type: 'phonics'; data: Passage; withTimer?: boolean }
  | { type: 'spelling'; data: Wordset; withTimer?: boolean }
  | { type: 'wordset'; data: Wordset; withTimer?: boolean }
  | { type: 'drill'; data: DrillData; withTimer?: boolean };

export interface BadgeDefinition {
  id: string;
  label: string;
  desc: string;
  track: string;
  tier: number;
  requires?: string | string[];
  hidden?: boolean;
}

export interface EarnedBadge {
  id: string;
  earnedAt: string;
}

export interface CopyData {
  homeChangeLesson: string;
  lockstepOn: string;
  focusLineOn: string;
  metricAccuracy: string;
  metricWPM: string;
  metricTime: string;
  metricErrors: string;
  summaryNiceWork: string;
  summaryReplay: string;
  summaryHome: string;
  summaryDrill: string;
  summaryHardestKeys: string;
  summaryTrickyWords: string;
  pasteBlocked: string;
  encourageGentle: string[];
}

export interface AppData {
  PASSAGES: Passage[];
  WORDSETS: Wordset[];
  PATTERNS: PatternPack[];
  PHONICS: Passage[];
  SPELLING: Wordset[];
  BADGES: BadgeDefinition[];
  COPY: CopyData;
}

export interface Settings {
  font: FontName;
  lineHeight: number;
  letterSpacing: number;
  theme: ThemeName;
  lockstepDefault: boolean;
  focusLineDefault: boolean;
  keyboardHintDefault: boolean;
  showTimerDisplay: boolean;
  defaultStage: Stage;
  pin: string | null;
  soundEnabled: boolean;
  fingerGuide: boolean;
  reduceMotion: boolean;
  voiceGender: VoiceGender;
  voiceSpeed: number;
}

export interface Progress {
  minutesTotal: number;
  wordsTotal: number;
  badges: EarnedBadge[];
  themesCompleted: Record<string, boolean>;
  stagesCompleted: Record<string, boolean>;
  lastPlayed: string | null;
  consecutiveDays: number;
  completedPassages: ContentId[];
  completedSpellings: ContentId[];
  completedPhonics: ContentId[];
  completedWordsets: ContentId[];
}

export type CompletedListKey =
  | 'completedPassages'
  | 'completedSpellings'
  | 'completedPhonics'
  | 'completedWordsets';

export interface SessionFlags {
  lockstep: boolean;
  focusLine: boolean;
  keyboardHint: boolean;
  timer: boolean;
  countdownTimer: boolean;
  showTimerChip: boolean;
  punct: boolean;
}

export interface SessionMetrics {
  accuracy: number;
  durationSec: number;
  errors: number;
  netWPM: number;
  grossWPM: number;
  hardestKeys: string[];
  trickyWords: string[];
}

export interface SessionRecord extends SessionMetrics {
  id: string;
  ts: string;
  contentId: ContentId;
  contentType: LessonType;
  title: string;
  stage?: string;
  completionPercent: number;
  flags: SessionFlags;
}

export interface Meta {
  hasSeenWelcome: boolean;
  welcomeVersion: number;
  lastLessonId: LessonKey | null;
}

export interface LessonPickerState {
  searchTerm: string;
  sortKey: SortKey;
  statusFilter: StatusFilter;
  currentPage: number;
  currentType: LessonType;
  currentStage: string;
  totalPages: number;
  hasAutoScrolled: boolean;
}

export interface UIState {
  currentScreen: ScreenName;
  modal: ModalName | null;
  lastFocus: HTMLElement | null;
  picker: LessonPickerState;
}

export interface PersonalBest {
  netWPM: number;
  accuracy: number;
}

export interface SummaryResults extends SessionMetrics {
  newBadges: string[];
  isDrill: boolean;
  personalBest: PersonalBest | null;
}

export interface SessionTimer {
  handle: ReturnType<typeof setInterval> | null;
  paused: boolean;
  manualPaused?: boolean;
  autoPaused?: boolean;
  remaining: number;
  started: boolean;
  startedAtMs: number | null;
  accumulatedMs: number;
  tick?: () => void;
}

export interface StartSessionOptions {
  resumedTypedText?: string;
}

export interface Runtime {
  lesson?: Lesson;
  targetText?: string;
  targetTextNorm?: string;
  initialInput?: string;
  baselineChars?: number;
  startTime?: Date;
  runtimeErrors?: number;
  hardestKeys?: Record<string, number>;
  flags?: SessionFlags;
  isDrill?: boolean;
  timer?: SessionTimer;
  lineElements?: HTMLElement[];
  vanishedLines?: Set<number>;
  wpmSamples?: number[];
  wpmSampleInterval?: ReturnType<typeof setInterval> | null;
  summaryResults?: SummaryResults;
  abortController?: AbortController | null;
}

export interface AppState {
  settings: Settings;
  progress: Progress;
  sessions: SessionRecord[];
  meta: Meta;
  ui: UIState;
  runtime: Runtime;
}

export interface PersistedState {
  _v: number;
  settings?: Partial<Settings>;
  progress?: Partial<Progress>;
  sessions?: SessionRecord[];
  meta?: {
    hasSeenWelcome?: boolean;
    welcomeVersion?: number;
    lastLessonId?: string | null;
  };
}

export interface Draft {
  lessonId: ContentId;
  lessonType: LessonType;
  typedText: string;
  lessonData: LessonData;
  savedAt: number;
}

export interface LessonPickerItem {
  id: ContentId;
  type: LessonType;
  lessonKey: LessonKey;
  title: string;
  theme?: string;
  icon: string;
  lenDisplay: string;
  completionPercent: number;
  completionLabel: string;
  isComplete: boolean;
  isLastVisited: boolean;
  hasCaps: boolean;
  hasPunct: boolean;
  preview: string;
}

export interface LessonPickerViewModel {
  items: LessonPickerItem[];
  currentPage: number;
  totalPages: number;
  totalFiltered: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
  currentType: LessonType;
  currentStage: string;
  lastLessonKey: LessonKey | null;
}

export type ShowScreenFn = (screen: ScreenName) => void;
export type PersistStateFn = () => void;

export interface SpeakOptions {
  gender?: VoiceGender;
  speed?: number;
}
