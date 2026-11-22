/**
 * Functional smoke test.
 *
 * Drives the real app in headless Chrome/Chromium/Edge and asserts that the
 * interactive wiring holds: screens, lesson flow, badge awards, drafts,
 * settings, Parent PIN verification/removal, lesson picker, and audit.html.
 *
 * Automatically starts and tears down an ephemeral Vite server when one is not
 * already listening on SK_BASE / http://localhost:5173.
 *
 * Usage:
 *   npm run check:smoke
 */
import { ensureAppServer, launchHeadlessBrowser, sleep } from './lib/cdp.mjs';

/** Runs in the main app page. Returns { checks: [[name, ok, detail]...] }. */
const APP_SCRIPT = `(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const checks = [];
  const ok = (name, cond, detail = '') => checks.push([name, !!cond, String(detail)]);
  const $ = sel => document.querySelector(sel);
  const id = x => document.getElementById(x);
  const waitUntil = async (fn, tries = 50, delay = 100) => {
    for (let i = 0; i < tries; i++) {
      const val = fn();
      if (val) return val;
      await sleep(delay);
    }
    return null;
  };
  const waitFor = (sel, tries = 50) => waitUntil(() => $(sel), tries);

  let alertCount = 0;
  window.confirm = () => true;
  window.alert = () => { alertCount++; };

  // --- home ---------------------------------------------------------------
  await waitFor('#home-screen', 80);
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
    await waitUntil(() => document.querySelectorAll('#new-story-card [data-stage]').length >= 4);
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
  ok('progressbar aria attributes', id('typing-progress-bar')?.parentElement?.getAttribute('aria-valuemin') === '0' &&
     id('typing-progress-bar')?.parentElement?.getAttribute('aria-valuemax') === '100');

  // focus-line toggle should flip the class on the target
  const target = id('typing-target');
  const before = target.classList.contains('focus-line-active');
  const fl = id('focusline-toggle');
  fl.checked = !fl.checked;
  fl.dispatchEvent(new Event('change', { bubbles: true }));
  await waitUntil(() => target.classList.contains('focus-line-active') !== before);
  ok('focus line toggle works', target.classList.contains('focus-line-active') !== before);

  // --- type part of it & verify zero glyph/line expansion -----------------
  await waitUntil(() => document.querySelectorAll('#typing-target .line').length > 0);
  const baseHeight = target.getBoundingClientRect().height;
  const baseCoords = Array.from(document.querySelectorAll('#typing-target .char')).map(c => c.offsetLeft + ',' + c.offsetTop);

  const full = Array.from(document.querySelectorAll('#typing-target .char')).map(c => c.textContent).join('');
  input.value = full.slice(0, Math.min(90, full.length - 2));
  input.dispatchEvent(new Event('input', { bubbles: true }));
  const afterHeight = target.getBoundingClientRect().height;
  const afterCoords = Array.from(document.querySelectorAll('#typing-target .char')).map(c => c.offsetLeft + ',' + c.offsetTop);
  const singleRowPerLine = Array.from(document.querySelectorAll('#typing-target .line')).every(
    l => new Set(Array.from(l.querySelectorAll('.char')).map(c => c.offsetTop)).size <= 1
  );
  ok('typed text never expands or shifts character positions',
     afterHeight === baseHeight && singleRowPerLine && baseCoords.every((v, i) => v === afterCoords[i]),
     'dH=' + (Math.round((afterHeight - baseHeight) * 10) / 10) + 'px');

  input.value = full.slice(0, 20);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  await waitUntil(() => document.querySelectorAll('#typing-target .char.correct').length === 20);
  ok('correct letters marked', document.querySelectorAll('#typing-target .char.correct').length > 0,
     document.querySelectorAll('#typing-target .char.correct').length + ' correct');
  ok('cursor letter marked', document.querySelectorAll('#typing-target .char.current').length === 1);
  ok('progress bar advanced', parseFloat(id('typing-progress-bar').style.width) > 0,
     id('typing-progress-bar').style.width);

  // --- exit saves a draft -------------------------------------------------
  id('exit-lesson-btn').click();
  await waitFor('#home-screen');
  ok('exit returns home', !!id('home-screen'));
  ok('draft card offered', !!id('resume-draft-card'));
  ok('resume button', !!id('resume-draft-btn'));

  // --- resume it ----------------------------------------------------------
  id('resume-draft-btn').click();
  const input2 = await waitFor('#typing-input');
  ok('resume reopens lesson', !!input2);
  ok('resume restores text', input2 && input2.value.length === 20, input2 ? input2.value.length + ' chars' : 'none');

  // --- finish it & earn first badge --------------------------------------
  const full2 = Array.from(document.querySelectorAll('#typing-target .char')).map(c => c.textContent).join('');
  input2.value = full2;
  input2.dispatchEvent(new Event('input', { bubbles: true }));
  const summary = await waitFor('#summary-screen');
  ok('summary screen opens', !!summary);
  ok('first completed lesson awards badge', document.querySelectorAll('#summary-screen .badge-earned').length > 0,
     document.querySelectorAll('#summary-screen .badge-earned').length + ' earned');
  ok('replay button', !!id('replay-btn'));
  ok('home button', !!id('home-btn'));
  await sleep(2200); // outlast any 2s draft debounce window
  ok('completed lesson clears draft', localStorage.getItem('storykeys_draft') === null);

  id('home-btn').click();
  await waitFor('#home-screen');

  // --- settings round-trip + set Parent PIN -------------------------------
  id('settings-btn').click();
  await waitUntil(() => $('#modal-container .modal') && getComputedStyle($('#modal-container .modal')).display === 'flex');
  ok('settings modal visible', $('#modal-container .modal') && getComputedStyle($('#modal-container .modal')).display === 'flex');
  ok('settings controls bound', !!id('setting-theme') && !!id('setting-line-height') && !!id('save-settings-btn'));
  ok('settings values populated', id('setting-line-height').value !== '');
  id('setting-theme').value = 'dark';
  id('setting-pin').value = '1234';
  id('save-settings-btn').click();
  await waitUntil(() => !$('#modal-container .modal'));
  ok('theme applied', document.documentElement.classList.contains('theme-dark'));
  ok('theme persisted', (JSON.parse(localStorage.getItem('storykeys_state')).settings || {}).theme === 'dark');
  ok('parent PIN persisted as hash', Boolean((JSON.parse(localStorage.getItem('storykeys_state')).settings || {}).pin));
  ok('modal closed after save', !$('#modal-container .modal'));
  ok('scroll unlocked', !document.body.classList.contains('modal-open'));

  // --- parent PIN verification & inline error + removal -------------------
  id('parent-btn').click();
  await waitFor('#pin-title');
  ok('parent button opens PIN prompt', !!id('pin-title'));
  id('pin-input').value = '9999';
  id('pin-submit-btn').click();
  await waitUntil(() => id('pin-error') && !id('pin-error').classList.contains('hidden'));
  ok('wrong PIN shows inline alert without window.alert', !id('pin-error').classList.contains('hidden') && alertCount === 0);

  id('pin-input').value = '1234';
  id('pin-submit-btn').click();
  await waitFor('#parent-title');
  ok('correct PIN opens Parent view', !!id('parent-title'));
  id('close-modal-btn').click();
  await waitUntil(() => !$('#modal-container .modal'));

  id('settings-btn').click();
  await waitFor('#clear-pin-btn');
  ok('settings shows current PIN & remove controls when PIN set', !!id('setting-current-pin') && !!id('clear-pin-btn'));
  id('clear-pin-btn').click();
  id('setting-current-pin').value = '1234';
  id('save-settings-btn').click();
  await waitUntil(() => !$('#modal-container .modal'));
  ok('verified PIN removal clears stored PIN', (JSON.parse(localStorage.getItem('storykeys_state')).settings || {}).pin === null);

  // --- lesson picker ------------------------------------------------------
  id('browse-lessons-btn').click();
  await waitUntil(() => document.querySelectorAll('.lesson-item').length > 0);
  ok('picker modal visible', $('#modal-container .modal') && getComputedStyle($('#modal-container .modal')).display === 'flex');
  ok('picker lists lessons', document.querySelectorAll('.lesson-item').length > 0,
     document.querySelectorAll('.lesson-item').length + ' items');
  ok('active stage highlighted', !!$('.stage-filter .active'));

  const spellingTab = $('.tab-button[data-type="spelling"]');
  spellingTab.click();
  await waitUntil(() => $('.lesson-item')?.dataset.type === 'spelling');
  ok('tab switch reloads list', document.querySelectorAll('.lesson-item').length > 0,
     document.querySelectorAll('.lesson-item').length + ' items');

  $('.tab-button[data-type="passage"]').click();
  await waitUntil(() => $('.lesson-item')?.dataset.type === 'passage');
  const startBtn = $('.lesson-item [data-start]');
  ok('picker start button', !!startBtn);
  startBtn.click();
  const input3 = await waitFor('#typing-input');
  ok('picker starts a lesson', !!input3);

  // --- escape closes a modal ---------------------------------------------
  id('help-btn').click();
  await waitFor('#help-title');
  const helpOpen = !!$('#modal-container .modal');
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  await waitUntil(() => !$('#modal-container .modal'));
  ok('escape closes modal', helpOpen && !$('#modal-container .modal'));

  return { checks };
})()`;

const AUDIT_SCRIPT = `(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  for (let i = 0; i < 60; i++) {
    const val = document.getElementById('totalPassages')?.textContent;
    if (val && val !== '-') break;
    await sleep(100);
  }
  const passages = document.getElementById('totalPassages')?.textContent;
  const badges = document.getElementById('totalBadges')?.textContent;
  const externalScripts = document.querySelectorAll('script[src^="http"]').length;

  let pdfBlobSize = 0;
  const origCreateObjectURL = URL.createObjectURL.bind(URL);
  URL.createObjectURL = (obj) => {
    if (obj instanceof Blob && obj.type === 'application/pdf') {
      pdfBlobSize = obj.size;
    }
    return origCreateObjectURL(obj);
  };
  document.getElementById('pdf-badges-btn')?.click();
  for (let i = 0; i < 60; i++) {
    if (pdfBlobSize > 0) break;
    await sleep(100);
  }
  URL.createObjectURL = origCreateObjectURL;

  return {
    checks: [
      ['audit dashboard loads passages', passages === '608', String(passages)],
      ['audit dashboard loads badges', badges === '62', String(badges)],
      ['audit has zero external scripts', externalScripts === 0, externalScripts + ' external'],
      ['audit offline PDF export generates PDF blob', pdfBlobSize > 1000, pdfBlobSize + ' bytes'],
    ],
  };
})()`;

let server;
let browser;

try {
  server = await ensureAppServer();
  browser = await launchHeadlessBrowser({ prefix: 'sk-smoke' });
  const { cdp } = browser;

  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  await cdp.send('Page.enable', {}, sessionId);
  await cdp.send('Runtime.enable', {}, sessionId);

  await cdp.send(
    'Emulation.setDeviceMetricsOverride',
    { width: 1280, height: 1000, deviceScaleFactor: 1, mobile: false },
    sessionId,
  );

  // Start from a clean slate.
  await cdp.send('Page.navigate', { url: server.baseUrl }, sessionId);
  await sleep(1000);
  await cdp.send('Runtime.evaluate', {
    expression: `localStorage.clear(); localStorage.setItem('storykeys_state', JSON.stringify({_v:1,meta:{hasSeenWelcome:true,welcomeVersion:1,lastLessonId:null}})); location.reload();`,
  }, sessionId).catch(() => null);
  await sleep(1200);

  const appRes = await cdp.send('Runtime.evaluate', {
    expression: APP_SCRIPT,
    awaitPromise: true,
    returnByValue: true,
  }, sessionId);

  if (appRes.exceptionDetails) {
    throw new Error(`App page threw: ${JSON.stringify(appRes.exceptionDetails.exception?.description || appRes.exceptionDetails)}`);
  }

  await cdp.send('Page.navigate', { url: `${server.baseUrl}/audit.html` }, sessionId);
  await sleep(800);
  const auditRes = await cdp.send('Runtime.evaluate', {
    expression: AUDIT_SCRIPT,
    awaitPromise: true,
    returnByValue: true,
  }, sessionId);

  if (auditRes.exceptionDetails) {
    throw new Error(`Audit page threw: ${JSON.stringify(auditRes.exceptionDetails.exception?.description || auditRes.exceptionDetails)}`);
  }

  const checks = [...appRes.result.value.checks, ...auditRes.result.value.checks];
  let failed = 0;
  for (const [name, pass, detail] of checks) {
    if (!pass) failed++;
    console.log(`${pass ? 'ok  ' : 'FAIL'} ${name}${detail ? `  (${detail})` : ''}`);
  }
  console.log(`\n${checks.length - failed}/${checks.length} checks passed`);

  await browser.close();
  await server.close();
  process.exit(failed === 0 ? 0 : 1);
} catch (err) {
  console.error(err);
  if (browser) await browser.close();
  if (server) await server.close();
  process.exit(1);
}
