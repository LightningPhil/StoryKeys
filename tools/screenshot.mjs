/**
 * Visual review harness.
 *
 * Drives a headless Chrome over the DevTools Protocol and screenshots every
 * screen, modal and breakpoint, so UI changes can be eyeballed side by side.
 * Uses Node's built-in WebSocket (Node >= 22), so there is nothing to install.
 *
 * Usage:
 *   npm run dev                        # in another terminal
 *   node tools/screenshot.mjs out-dir [name-filter]
 */
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const CHROME = process.env.SK_CHROME || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = process.env.SK_BASE || 'http://localhost:5173';
const OUT = process.argv[2] || join(process.cwd(), 'shots');
const ONLY = process.argv[3] || null;
const PORT = Number(process.env.SK_PORT || 9333);
// Unique per run so a lingering Chrome from a previous run cannot lock it.
const PROFILE = join(tmpdir(), `sk-chrome-profile-${Date.now()}`);

mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const chrome = spawn(CHROME, [
  '--headless=new',
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${PROFILE}`,
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-extensions',
  '--hide-scrollbars',
  '--force-prefers-reduced-motion',
  '--force-color-profile=srgb',
  'about:blank',
], { stdio: 'ignore' });

async function browserWs() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      const j = await r.json();
      if (j.webSocketDebuggerUrl) return j.webSocketDebuggerUrl;
    } catch { /* not up yet */ }
    await sleep(250);
  }
  throw new Error('Chrome did not expose a debugging socket');
}

class Cdp {
  constructor(url) {
    this.ws = new WebSocket(url);
    this.id = 0;
    this.pending = new Map();
    this.ready = new Promise((res, rej) => {
      this.ws.addEventListener('open', () => res());
      this.ws.addEventListener('error', (e) => rej(e));
    });
    this.ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(JSON.stringify(msg.error)));
        else resolve(msg.result);
      }
    });
  }
  send(method, params = {}, sessionId) {
    const id = ++this.id;
    const payload = { id, method, params };
    if (sessionId) payload.sessionId = sessionId;
    this.ws.send(JSON.stringify(payload));
    return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }));
  }
}

/** Each scenario seeds state, drives the UI, then gets screenshotted. */
const SCENARIOS = [
  { name: '01-home-cream', width: 1280, height: 1100,
    run: `seedState({theme:'cream'}); await reload(); await sleep(900);` },
  { name: '02-home-dark', width: 1280, height: 1100,
    run: `seedState({theme:'dark'}); await reload(); await sleep(900);` },
  { name: '03-welcome-modal', width: 1280, height: 900,
    run: `localStorage.clear(); seedState({theme:'cream'}, true); await reload(); await sleep(900); document.getElementById('start-here-btn').click(); await sleep(400);` },
  { name: '04-lesson-picker', width: 1280, height: 900,
    run: `seedState({theme:'cream'}); await reload(); await sleep(900); document.getElementById('browse-lessons-btn').click(); await sleep(900);` },
  { name: '05-settings', width: 1280, height: 1000,
    run: `seedState({theme:'cream'}); await reload(); await sleep(900); document.getElementById('settings-btn').click(); await sleep(500);` },
  { name: '06-typing', width: 1280, height: 1000,
    run: `seedState({theme:'cream'}); await reload(); await sleep(900); await startLesson(); await typeSome(0.35); await sleep(500);` },
  { name: '07-typing-error', width: 1280, height: 1000,
    run: `seedState({theme:'cream', lockstepDefault:false}); await reload(); await sleep(900); await startLesson(); await typeWrong(); await sleep(500);` },
  { name: '08-summary', width: 1280, height: 1200,
    run: `seedState({theme:'cream'}); await reload(); await sleep(900); await startLesson(); await finishLesson(); await sleep(900);` },
  { name: '09-badges', width: 1280, height: 900,
    run: `seedState({theme:'cream'}); await reload(); await sleep(900); await startLesson(); await finishLesson(); await sleep(900); document.getElementById('home-btn').click(); await sleep(400); document.getElementById('view-badges-btn').click(); await sleep(500);` },
  { name: '10-parent', width: 1280, height: 900,
    run: `seedState({theme:'cream'}); await reload(); await sleep(900); await startLesson(); await finishLesson(); await sleep(800); document.getElementById('home-btn').click(); await sleep(400); document.getElementById('parent-btn').click(); await sleep(500);` },
  { name: '11-help', width: 1280, height: 1000,
    run: `seedState({theme:'cream'}); await reload(); await sleep(900); document.getElementById('help-btn').click(); await sleep(500);` },
  { name: '12-mobile-home', width: 420, height: 1000,
    run: `seedState({theme:'cream'}); await reload(); await sleep(900);` },
  { name: '13-mobile-typing', width: 420, height: 1000,
    run: `seedState({theme:'cream'}); await reload(); await sleep(900); await startLesson(); await typeSome(0.3); await sleep(500);` },
  { name: '14-typing-helpers', width: 1280, height: 1250,
    run: `seedState({theme:'cream', keyboardHintDefault:true, fingerGuide:true, showTimerDisplay:true}); await reload(); await sleep(900); await startLesson(); await typeSome(0.3); await sleep(500);` },
  { name: '15-typing-caps', width: 1280, height: 1000,
    run: `seedState({theme:'cream'}); await reload(); await sleep(900); await startLesson(); await typeSome(0.2); document.getElementById('caps-lock-indicator').classList.add('active'); await sleep(400);` },
  { name: '16-typing-dark-helpers', width: 1280, height: 1250,
    run: `seedState({theme:'dark', keyboardHintDefault:true, fingerGuide:true}); await reload(); await sleep(900); await startLesson(); await typeSome(0.45); await sleep(500);` },
  { name: '17-mobile-summary', width: 420, height: 1250,
    run: `seedState({theme:'cream'}); await reload(); await sleep(900); await startLesson(); await finishLesson(); await sleep(900);` },
];

/** Helpers injected into the page for every scenario. */
const PRELUDE = `
const sleep = ms => new Promise(r => setTimeout(r, ms));
function seedState(settings = {}, fresh = false) {
  if (fresh) { localStorage.clear(); return; }
  localStorage.setItem('storykeys_state', JSON.stringify({
    _v: 1,
    settings: Object.assign({ theme: 'cream', defaultStage: 'KS2' }, settings),
    progress: { minutesTotal: 42, wordsTotal: 900, badges: [], themesCompleted: {}, stagesCompleted: {},
                lastPlayed: new Date().toDateString(), consecutiveDays: 3,
                completedPassages: [], completedSpellings: [], completedPhonics: [], completedWordsets: [] },
    sessions: [],
    meta: { hasSeenWelcome: true, welcomeVersion: 1, lastLessonId: null },
  }));
  localStorage.removeItem('storykeys_draft');
}
function reload() { location.reload(); return new Promise(() => {}); }
async function startLesson() {
  document.querySelector('#new-story-card [data-stage]').click();
  for (let i = 0; i < 40; i++) { await sleep(150); if (document.getElementById('typing-input')) break; }
  await sleep(300);
}
function targetText() {
  return Array.from(document.querySelectorAll('#typing-target .char')).map(c => c.textContent).join('');
}
async function typeSome(fraction) {
  const t = targetText();
  const input = document.getElementById('typing-input');
  input.value = t.slice(0, Math.floor(t.length * fraction));
  input.dispatchEvent(new Event('input', { bubbles: true }));
  await sleep(300);
}
async function typeWrong() {
  const t = targetText();
  const input = document.getElementById('typing-input');
  const good = t.slice(0, 24).split('');
  good[8] = 'x'; good[15] = 'q';
  input.value = good.join('');
  input.dispatchEvent(new Event('input', { bubbles: true }));
  await sleep(300);
}
async function finishLesson() {
  const t = targetText();
  const input = document.getElementById('typing-input');
  input.value = t;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  for (let i = 0; i < 40; i++) { await sleep(150); if (document.getElementById('summary-screen')) break; }
}
`;

(async () => {
  const wsUrl = await browserWs();
  const cdp = new Cdp(wsUrl);
  await cdp.ready;

  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  await cdp.send('Page.enable', {}, sessionId);
  await cdp.send('Runtime.enable', {}, sessionId);

  const scenarios = ONLY ? SCENARIOS.filter((s) => s.name.includes(ONLY)) : SCENARIOS;

  for (const s of scenarios) {
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: s.width, height: s.height, deviceScaleFactor: 1, mobile: s.width < 600,
    }, sessionId);

    await cdp.send('Page.navigate', { url: BASE }, sessionId);
    await sleep(1400);

    // Seed + reload first; the reload discards the evaluate promise by design.
    await cdp.send('Runtime.evaluate', {
      expression: `(async () => { ${PRELUDE} try { ${s.run} } catch (e) { return 'ERR: ' + e.message; } return 'ok'; })()`,
      awaitPromise: false, returnByValue: true,
    }, sessionId).catch(() => null);
    await sleep(2600);

    // Then re-run the post-reload steps against the fresh page.
    const post = s.run.replace(/seedState\([^;]*\);\s*await reload\(\);\s*await sleep\(\d+\);/, '');
    if (post.trim()) {
      await cdp.send('Runtime.evaluate', {
        expression: `(async () => { ${PRELUDE} try { ${post} } catch (e) { return 'ERR: ' + e.message; } return 'ok'; })()`,
        awaitPromise: true, returnByValue: true,
      }, sessionId).catch(() => null);
    }
    await sleep(600);

    const { data } = await cdp.send('Page.captureScreenshot', {
      format: 'png', captureBeyondViewport: true,
    }, sessionId);
    writeFileSync(join(OUT, `${s.name}.png`), Buffer.from(data, 'base64'));
    console.log(`captured ${s.name}.png  (${s.width}x${s.height})`);
  }

  chrome.kill();
  process.exit(0);
})().catch((e) => { console.error(e); chrome.kill(); process.exit(1); });
