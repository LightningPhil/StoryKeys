import type { SpeakOptions } from '../types';

let audioContext: AudioContext | null = null;
let currentUtterance: SpeechSynthesisUtterance | null = null;

function getAudioContext(): AudioContext | null {
  if (!audioContext) {
    try {
      const Ctor = window.AudioContext ?? window.webkitAudioContext;
      if (!Ctor) return null;
      audioContext = new Ctor();
    } catch (e) {
      console.warn('Web Audio API not supported:', e);
      return null;
    }
  }
  return audioContext;
}

function resumeIfNeeded(ctx: AudioContext): void {
  if (ctx.state === 'suspended') {
    void ctx.resume();
  }
}

export function playClickSound(enabled: boolean | undefined): void {
  if (!enabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  resumeIfNeeded(ctx);

  const oscillator = ctx.createOscillator();
  const gainNode = ctx.createGain();
  oscillator.connect(gainNode);
  gainNode.connect(ctx.destination);
  oscillator.frequency.setValueAtTime(800, ctx.currentTime);
  oscillator.type = 'sine';
  gainNode.gain.setValueAtTime(0.03, ctx.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
  oscillator.start(ctx.currentTime);
  oscillator.stop(ctx.currentTime + 0.05);
}

export function playErrorSound(enabled: boolean | undefined): void {
  if (!enabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  resumeIfNeeded(ctx);

  const oscillator = ctx.createOscillator();
  const gainNode = ctx.createGain();
  oscillator.connect(gainNode);
  gainNode.connect(ctx.destination);
  oscillator.frequency.setValueAtTime(200, ctx.currentTime);
  oscillator.type = 'sine';
  gainNode.gain.setValueAtTime(0.05, ctx.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
  oscillator.start(ctx.currentTime);
  oscillator.stop(ctx.currentTime + 0.08);
}

export function playSuccessSound(enabled: boolean | undefined): void {
  if (!enabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  resumeIfNeeded(ctx);

  const playNote = (freq: number, delay: number, duration: number) => {
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    oscillator.frequency.setValueAtTime(freq, ctx.currentTime + delay);
    oscillator.type = 'sine';
    gainNode.gain.setValueAtTime(0.08, ctx.currentTime + delay);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + duration);
    oscillator.start(ctx.currentTime + delay);
    oscillator.stop(ctx.currentTime + delay + duration);
  };

  playNote(523.25, 0, 0.15);
  playNote(659.25, 0.12, 0.2);
}

export function isSpeechAvailable(): boolean {
  return 'speechSynthesis' in window;
}

export function speakText(
  text: string,
  onEnd?: (() => void) | null,
  onStart?: (() => void) | null,
  options: SpeakOptions = {},
): boolean {
  if (!isSpeechAvailable()) return false;

  stopSpeaking();
  currentUtterance = new SpeechSynthesisUtterance(text);
  currentUtterance.rate = options.speed ?? 0.85;
  currentUtterance.pitch = 1.0;

  const preferFemale = options.gender !== 'male';
  const voices = window.speechSynthesis.getVoices();
  const femaleKeywords = ['female', 'zira', 'hazel', 'susan', 'samantha', 'karen', 'moira', 'fiona', 'victoria', 'kate'];
  const maleKeywords = ['male', 'david', 'mark', 'james', 'daniel', 'george', 'alex'];
  const genderKeywords = preferFemale ? femaleKeywords : maleKeywords;

  let voice = voices.find((v) =>
    v.lang.startsWith('en') && genderKeywords.some((kw) => v.name.toLowerCase().includes(kw)),
  );
  if (!voice && preferFemale) {
    voice = voices.find((v) => v.lang.startsWith('en') && v.name.includes('Google'));
  }
  if (!voice) {
    voice = voices.find((v) => v.lang.startsWith('en'));
  }
  if (voice) {
    currentUtterance.voice = voice;
  }

  currentUtterance.onstart = () => {
    onStart?.();
  };
  currentUtterance.onend = () => {
    currentUtterance = null;
    onEnd?.();
  };
  currentUtterance.onerror = (e) => {
    console.warn('Speech synthesis error:', e);
    currentUtterance = null;
    onEnd?.();
  };

  window.speechSynthesis.speak(currentUtterance);
  return true;
}

export function stopSpeaking(): void {
  if (window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
  currentUtterance = null;
}

export function isSpeaking(): boolean {
  return window.speechSynthesis?.speaking || false;
}
