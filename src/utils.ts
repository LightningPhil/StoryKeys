import type { LessonData } from './types';

const PUNCT_NORM: Record<string, string> = {
  '’': "'",
  '‘': "'",
  '“': '"',
  '”': '"',
  '–': '-',
  '—': '-',
  '…': '...',
  '\u00A0': ' ',
};

export function normaliseChar(ch: string): string {
  return PUNCT_NORM[ch] ?? ch;
}

export function normaliseString(s: string): string {
  return s.split('').map(normaliseChar).join('');
}

export function transformText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

export async function sha256Hex(s: string): Promise<string> {
  const buf = new TextEncoder().encode(s);
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function rawTrimToNormLen(raw: string, normLimit: number): string {
  let acc = 0;
  let out = '';
  for (const ch of raw) {
    acc += normaliseChar(ch).length;
    if (acc > normLimit) break;
    out += ch;
  }
  return out;
}

export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function getLessonTitle(data: Partial<LessonData> = {}): string {
  if ('title' in data && data.title) return data.title;
  if ('name' in data && data.name) return data.name;
  if ('id' in data && data.id) return data.id;
  return 'Lesson';
}

export function formatClock(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const m = String(Math.floor(safe / 60)).padStart(2, '0');
  const s = String(safe % 60).padStart(2, '0');
  return `${m}:${s}`;
}

export interface Debounced<Args extends unknown[]> {
  (...args: Args): void;
  cancel: () => void;
}

export function debounce<Args extends unknown[]>(
  func: (...args: Args) => void,
  wait: number,
): Debounced<Args> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const debounced = (...args: Args) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => {
      timeout = undefined;
      func(...args);
    }, wait);
  };
  debounced.cancel = () => {
    if (timeout) clearTimeout(timeout);
    timeout = undefined;
  };
  return debounced;
}

export function getElement<T extends HTMLElement>(id: string): T | null {
  return document.getElementById(id) as T | null;
}

export function isHtmlElement(value: EventTarget | null): value is HTMLElement {
  return value instanceof HTMLElement;
}
