/**
 * Shared headless-browser & ephemeral Vite server helpers for `smoke.mjs` and `screenshot.mjs`.
 * Zero external dependencies — uses Node's built-in `WebSocket`, `net`, and `child_process`.
 */
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function resolveChromePath() {
  if (process.env.SK_CHROME) {
    return process.env.SK_CHROME;
  }

  const candidates = [];
  if (process.platform === 'win32') {
    const localAppData = process.env.LOCALAPPDATA || '';
    candidates.push(
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      localAppData ? join(localAppData, 'Google\\Chrome\\Application\\chrome.exe') : '',
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    );
  } else if (process.platform === 'darwin') {
    candidates.push(
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    );
  } else {
    candidates.push(
      '/usr/bin/google-chrome',
      '/usr/bin/google-chrome-stable',
      '/usr/bin/chromium',
      '/usr/bin/chromium-browser',
      '/snap/bin/chromium',
    );
    for (const bin of ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'microsoft-edge']) {
      const probe = spawnSync('which', [bin], { encoding: 'utf8' });
      if (probe.status === 0 && probe.stdout.trim()) {
        candidates.push(probe.stdout.trim());
      }
    }
  }

  for (const candidate of candidates) {
    if (candidate && existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error(
    'Could not locate a Chromium-based browser (Chrome, Chromium, or Edge). Set SK_CHROME=/path/to/browser.',
  );
}

export function getFreePort() {
  return new Promise((resolvePort, reject) => {
    const srv = createServer();
    srv.unref();
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      srv.close(() => resolvePort(port));
    });
  });
}

async function isStoryKeysUp(baseUrl) {
  try {
    const res = await fetch(baseUrl);
    if (!res.ok) return false;
    const html = await res.text();
    return html.includes('StoryKeys');
  } catch {
    return false;
  }
}

export async function ensureAppServer() {
  if (process.env.SK_BASE) {
    const explicitUrl = process.env.SK_BASE.replace(/\/$/, '');
    if (!(await isStoryKeysUp(explicitUrl))) {
      throw new Error(`SK_BASE is set to ${explicitUrl}, but no StoryKeys server responded there.`);
    }
    return { baseUrl: explicitUrl, close: async () => {} };
  }

  const defaultUrl = 'http://localhost:5173';
  if (await isStoryKeysUp(defaultUrl)) {
    return { baseUrl: defaultUrl, close: async () => {} };
  }

  const port = await getFreePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const viteEntry = join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js');
  if (!existsSync(viteEntry)) {
    throw new Error(`Vite CLI not found at ${viteEntry}. Run npm install first.`);
  }

  const serverProc = spawn(
    process.execPath,
    [viteEntry, '--host', '127.0.0.1', '--port', String(port), '--strictPort'],
    { cwd: ROOT, stdio: 'ignore' },
  );

  for (let i = 0; i < 60; i++) {
    if (await isStoryKeysUp(baseUrl)) {
      return {
        baseUrl,
        close: async () => {
          try { serverProc.kill(); } catch { /* already stopped */ }
        },
      };
    }
    await sleep(200);
  }

  try { serverProc.kill(); } catch { /* ignore */ }
  throw new Error(`Timed out waiting for ephemeral Vite server on ${baseUrl}`);
}

export class Cdp {
  constructor(url) {
    this.ws = new WebSocket(url);
    this.id = 0;
    this.pending = new Map();
    this.ready = new Promise((res, rej) => {
      this.ws.addEventListener('open', () => res());
      this.ws.addEventListener('error', rej);
    });
    this.ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(String(ev.data));
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve: res, reject: rej } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) rej(new Error(JSON.stringify(msg.error)));
        else res(msg.result);
      }
    });
  }

  send(method, params = {}, sessionId) {
    const id = ++this.id;
    const payload = { id, method, params };
    if (sessionId) payload.sessionId = sessionId;
    this.ws.send(JSON.stringify(payload));
    return new Promise((res, rej) => this.pending.set(id, { resolve: res, reject: rej }));
  }

  close() {
    try { this.ws.close(); } catch { /* ignore */ }
  }
}

async function waitForDebuggerWs(port) {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/json/version`);
      const j = await r.json();
      if (j.webSocketDebuggerUrl) return j.webSocketDebuggerUrl;
    } catch { /* not up yet */ }
    await sleep(200);
  }
  throw new Error(`Browser did not expose a DevTools socket on port ${port}`);
}

export async function launchHeadlessBrowser({ extraArgs = [], prefix = 'sk-browser' } = {}) {
  const chromePath = resolveChromePath();
  const port = process.env.SK_PORT ? Number(process.env.SK_PORT) : await getFreePort();
  const profileDir = join(tmpdir(), `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);

  const proc = spawn(
    chromePath,
    [
      '--headless=new',
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${profileDir}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-extensions',
      ...extraArgs,
      'about:blank',
    ],
    { stdio: 'ignore' },
  );

  try {
    const wsUrl = await waitForDebuggerWs(port);
    const cdp = new Cdp(wsUrl);
    await cdp.ready;
    return {
      cdp,
      close: async () => {
        cdp.close();
        try { proc.kill(); } catch { /* ignore */ }
        await sleep(150);
        try { rmSync(profileDir, { recursive: true, force: true }); } catch { /* best-effort */ }
      },
    };
  } catch (err) {
    try { proc.kill(); } catch { /* ignore */ }
    try { rmSync(profileDir, { recursive: true, force: true }); } catch { /* ignore */ }
    throw err;
  }
}
