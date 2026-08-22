/**
 * Functional smoke test.
 *
 * Drives the real app in headless Chrome and asserts that the interactive
 * wiring still holds: every screen's controls resolve, toggles take effect,
 * drafts round-trip, settings persist, and the lesson picker starts a lesson.
 *
 * Usage:
 *   npm run dev                # in another terminal
 *   node tools/smoke.mjs
 */
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const CHROME = process.env.SK_CHROME || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = process.env.SK_BASE || 'http://localhost:5173';
const PORT = Number(process.env.SK_PORT || 9334);
const PROFILE = join(tmpdir(), `sk-smoke-profile-${Date.now()}`);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const chrome = spawn(CHROME, [
  '--headless=new',
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${PROFILE}`,
  '--no-first-run', '--no-default-browser-check', '--disable-extensions',
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
      this.ws.addEventListener('error', rej);
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

/** Runs in the page. Returns { checks: [[name, ok, detail]...] }. */
const SCRIPT = `(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const checks = [];
  const ok = (name, cond, detail = '') => checks.push([name, !!cond, String(detail)]);
  const $ = sel => document.querySelector(sel);
  const id = x => document.getElementById(x);
  const waitFor = async (sel, tries = 40) => {
    for (let i = 0; i < tries; i++) { if ($(sel)) return $(sel); await sleep(150); }
    return null;
  };
  window.confirm = () => true;   // requestLeaveTyping() asks before exiting
  window.alert = () => {};

  // --- home ---------------------------------------------------------------
  ok('home renders', !!id('home-screen'));
  ok('primary story button', !!$('#new-story-card [data-stage]'));
  ok('spelling button', !!$('#new-story-card [data-spelling-stage]'));
  ok('phonics button', !!id('phonics-mode-btn'));
  ok('browse lessons button', !!id('browse-lessons-btn'));
  ok('badges button', !!id('view-badges-btn'));

  const details = $('#new-story-card details');
  ok('other key stages disclosure', !!details);
  if (details) {
    details.open = true;
    await sleep(120);
    ok('all 4 stages reachable', document.querySelectorAll('#new-story-card [data-stage]').length >= 4,
       document.querySelectorAll('#new-story-card [data-stage]').length + ' stage buttons');
  }

  // --- start a lesson -----------------------------------------------------
  $('#new-story-card [data-stage]').click();
  const input = await waitFor('#typing-input');
  ok('typing screen opens', !!input);
  ok('exit button present', !!id('exit-lesson-btn'));
  ok('read aloud button', !!id('read-aloud-btn'));
  ok('lockstep toggle', !!id('lockstep-toggle'));
  ok('focus line toggle', !!id('focusline-toggle'));
  ok('caps indicator', !!id('caps-lock-indicator'));
  ok('target text rendered', document.querySelectorAll('#typing-target .char').length > 0);

  // focus-line toggle should flip the class on the target
  const target = id('typing-target');
  const before = target.classList.contains('focus-line-active');
  const fl = id('focusline-toggle');
  fl.checked = !fl.checked;
  fl.dispatchEvent(new Event('change', { bubbles: true }));
  await sleep(150);
  ok('focus line toggle works', target.classList.contains('focus-line-active') !== before);

  // --- type part of it ----------------------------------------------------
  const full = Array.from(document.querySelectorAll('#typing-target .char')).map(c => c.textContent).join('');
  input.value = full.slice(0, 20);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  await sleep(250);
  ok('correct letters marked', document.querySelectorAll('#typing-target .char.correct').length > 0,
     document.querySelectorAll('#typing-target .char.correct').length + ' correct');
  ok('cursor letter marked', document.querySelectorAll('#typing-target .char.current').length === 1);
  ok('progress bar advanced', parseFloat(id('typing-progress-bar').style.width) > 0,
     id('typing-progress-bar').style.width);

  // --- exit saves a draft -------------------------------------------------
  id('exit-lesson-btn').click();
  await sleep(400);
  ok('exit returns home', !!id('home-screen'));
  ok('draft card offered', !!id('resume-draft-card'));
  ok('resume button', !!id('resume-draft-btn'));

  // --- resume it ----------------------------------------------------------
  id('resume-draft-btn').click();
  const input2 = await waitFor('#typing-input');
  await sleep(500);
  ok('resume reopens lesson', !!input2);
  ok('resume restores text', input2 && input2.value.length > 0, input2 ? input2.value.length + ' chars' : 'none');

  // --- finish it ----------------------------------------------------------
  const full2 = Array.from(document.querySelectorAll('#typing-target .char')).map(c => c.textContent).join('');
  input2.value = full2;
  input2.dispatchEvent(new Event('input', { bubbles: true }));
  const summary = await waitFor('#summary-screen');
  ok('summary screen opens', !!summary);
  ok('replay button', !!id('replay-btn'));
  ok('home button', !!id('home-btn'));
  await sleep(2600);   // outlast the 2s debounced draft save
  ok('completed lesson clears draft', localStorage.getItem('storykeys_draft') === null);

  id('home-btn').click();
  await sleep(400);

  // --- settings round-trip ------------------------------------------------
  id('settings-btn').click();
  await sleep(400);
  ok('settings modal visible', $('#modal-container .modal') && getComputedStyle($('#modal-container .modal')).display === 'flex');
  ok('settings controls bound', !!id('setting-theme') && !!id('setting-line-height') && !!id('save-settings-btn'));
  ok('settings values populated', id('setting-line-height').value !== '');
  id('setting-theme').value = 'dark';
  id('save-settings-btn').click();
  await sleep(500);
  ok('theme applied', document.documentElement.classList.contains('theme-dark'));
  ok('theme persisted', (JSON.parse(localStorage.getItem('storykeys_state')).settings || {}).theme === 'dark');
  ok('modal closed after save', !$('#modal-container .modal'));
  ok('scroll unlocked', !document.body.classList.contains('modal-open'));

  // --- lesson picker ------------------------------------------------------
  id('browse-lessons-btn').click();
  await sleep(900);
  ok('picker modal visible', $('#modal-container .modal') && getComputedStyle($('#modal-container .modal')).display === 'flex');
  ok('picker lists lessons', document.querySelectorAll('.lesson-item').length > 0,
     document.querySelectorAll('.lesson-item').length + ' items');
  ok('active stage highlighted', !!$('.stage-filter .active'));

  const spellingTab = $('.tab-button[data-type="spelling"]');
  spellingTab.click();
  await sleep(900);
  ok('tab switch reloads list', document.querySelectorAll('.lesson-item').length > 0,
     document.querySelectorAll('.lesson-item').length + ' items');

  $('.tab-button[data-type="passage"]').click();
  await sleep(900);
  const startBtn = $('.lesson-item [data-start]');
  ok('picker start button', !!startBtn);
  startBtn.click();
  const input3 = await waitFor('#typing-input');
  ok('picker starts a lesson', !!input3);

  // --- escape closes a modal ---------------------------------------------
  id('help-btn').click();
  await sleep(350);
  const helpOpen = !!$('#modal-container .modal');
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  await sleep(400);
  ok('escape closes modal', helpOpen && !$('#modal-container .modal'));

  return { checks };
})()`;

(async () => {
  const cdp = new Cdp(await browserWs());
  await cdp.ready;
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  await cdp.send('Page.enable', {}, sessionId);
  await cdp.send('Runtime.enable', {}, sessionId);

  await cdp.send('Emulation.setDeviceMetricsOverride',
    { width: 1280, height: 1000, deviceScaleFactor: 1, mobile: false }, sessionId);

  // Start from a clean slate.
  await cdp.send('Page.navigate', { url: BASE }, sessionId);
  await sleep(1800);
  await cdp.send('Runtime.evaluate', {
    expression: `localStorage.clear(); localStorage.setItem('storykeys_state', JSON.stringify({_v:1,meta:{hasSeenWelcome:true,welcomeVersion:1,lastLessonId:null}})); location.reload();`,
  }, sessionId).catch(() => null);
  await sleep(2500);

  const errors = [];
  const res = await cdp.send('Runtime.evaluate', {
    expression: SCRIPT, awaitPromise: true, returnByValue: true,
  }, sessionId);

  if (res.exceptionDetails) {
    console.error('Page threw:', JSON.stringify(res.exceptionDetails.exception?.description || res.exceptionDetails));
    chrome.kill();
    process.exit(1);
  }

  const checks = res.result.value.checks;
  let failed = 0;
  for (const [name, pass, detail] of checks) {
    if (!pass) failed++;
    console.log(`${pass ? 'ok  ' : 'FAIL'} ${name}${detail ? `  (${detail})` : ''}`);
  }
  errors.forEach((e) => console.error(e));
  console.log(`\n${checks.length - failed}/${checks.length} checks passed`);

  chrome.kill();
  process.exit(failed === 0 ? 0 : 1);
})().catch((e) => { console.error(e); chrome.kill(); process.exit(1); });
