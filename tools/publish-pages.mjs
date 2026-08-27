/**
 * Copy the Vite production build to the repository root so GitHub Pages can
 * serve it from `main` `/` without a compile step.
 *
 * Source HTML stays in `dev/`. Do not edit the root `index.html` / `audit.html`.
 */
import { cpSync, existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const BANNER = '<!-- Generated for GitHub Pages by npm run build. Edit files in dev/ instead. -->\n';

function flattenHtml() {
  const pairs = [
    ['dev/index.html', 'index.html'],
    ['dev/audit.html', 'audit.html'],
  ];
  for (const [from, to] of pairs) {
    const src = join(dist, from);
    const dest = join(dist, to);
    if (existsSync(src)) {
      writeFileSync(dest, readFileSync(src, 'utf8'));
    }
  }
  const nestedDir = join(dist, 'dev');
  if (existsSync(nestedDir)) {
    rmSync(nestedDir, { recursive: true, force: true });
  }
}

function withBanner(html) {
  if (html.includes('Generated for GitHub Pages')) return html;
  const doctypeEnd = html.indexOf('\n');
  if (html.startsWith('<!DOCTYPE') || html.startsWith('<!doctype')) {
    if (doctypeEnd === -1) return `${html}\n${BANNER}`;
    return `${html.slice(0, doctypeEnd + 1)}${BANNER}${html.slice(doctypeEnd + 1)}`;
  }
  return BANNER + html;
}

function copyDir(src, dest) {
  if (!existsSync(src)) return;
  if (existsSync(dest)) rmSync(dest, { recursive: true, force: true });
  cpSync(src, dest, { recursive: true });
}

if (!existsSync(dist)) {
  throw new Error('dist/ is missing. Run `vite build` first.');
}

flattenHtml();

const indexSrc = join(dist, 'index.html');
const auditSrc = join(dist, 'audit.html');
if (!existsSync(indexSrc) || !existsSync(auditSrc)) {
  throw new Error('vite build did not produce index.html and audit.html in dist/');
}

writeFileSync(indexSrc, withBanner(readFileSync(indexSrc, 'utf8')));
writeFileSync(auditSrc, withBanner(readFileSync(auditSrc, 'utf8')));
writeFileSync(join(dist, '.nojekyll'), '');

cpSync(indexSrc, join(root, 'index.html'));
cpSync(auditSrc, join(root, 'audit.html'));
writeFileSync(join(root, '.nojekyll'), '');
copyDir(join(dist, 'assets'), join(root, 'assets'));
copyDir(join(dist, 'audit'), join(root, 'audit'));
copyDir(join(dist, 'data'), join(root, 'data'));

const published = readFileSync(join(root, 'index.html'), 'utf8');
if (published.includes('/src/main.ts') || published.includes('src/main.ts')) {
  throw new Error('Published index.html still points at TypeScript source.');
}
if (!published.includes('/StoryKeys/assets/')) {
  throw new Error('Published index.html is missing compiled /StoryKeys/assets/ URLs.');
}

console.log('Published production build to the repository root for GitHub Pages.');
