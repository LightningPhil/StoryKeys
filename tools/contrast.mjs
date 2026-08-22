/**
 * WCAG contrast check for the theme tokens in src/styles/app.css.
 *
 * Reads the real custom properties out of each .theme-* block so this can never
 * drift from the stylesheet, then checks every foreground/background pair the
 * UI actually puts together.
 *
 * Usage: node tools/contrast.mjs
 */
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../src/styles/app.css', import.meta.url), 'utf8');

/** Pull `--sk-*` declarations out of each `.theme-x { ... }` block. */
function readThemes(source) {
  const themes = {};
  const blockRe = /\.theme-([a-z]+)\s*\{([^}]*)\}/g;
  let m;
  while ((m = blockRe.exec(source))) {
    const vars = {};
    const varRe = /(--sk-[a-z-]+)\s*:\s*([^;]+);/g;
    let v;
    while ((v = varRe.exec(m[2]))) vars[v[1]] = v[2].trim();
    themes[m[1]] = vars;
  }
  return themes;
}

function srgbToLinear(c) {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

function luminance(hex) {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
}

function ratio(fg, bg) {
  const a = luminance(fg);
  const b = luminance(bg);
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}

// [label, foreground token, background token, minimum required]
// 3.0 is the AA threshold for large/bold text and UI component boundaries.
const PAIRS = [
  ['body text on card', '--sk-text', '--sk-card', 4.5],
  ['body text on page', '--sk-text', '--sk-bg', 4.5],
  ['body text on subtle', '--sk-text', '--sk-subtle', 4.5],
  ['muted text on card', '--sk-muted', '--sk-card', 4.5],
  ['muted text on subtle', '--sk-muted', '--sk-subtle', 4.5],
  ['muted text on page', '--sk-muted', '--sk-bg', 4.5],
  ['accent link on card', '--sk-accent', '--sk-card', 4.5],
  ['ink on accent button', '--sk-on-accent', '--sk-accent', 4.5],
  ['correct letter on subtle', '--sk-good', '--sk-subtle', 4.5],
  ['error letter on subtle', '--sk-bad', '--sk-subtle', 4.5],
  ['ink on error button', '--sk-on-bad', '--sk-bad', 4.5],
  ['warm text on warm panel', '--sk-warm', '--sk-warm-soft', 4.5],
  ['accent on accent-soft panel', '--sk-accent', '--sk-accent-soft', 4.5],
  ['border against card', '--sk-border', '--sk-card', 1.2],
  ['focus ring against page', '--sk-accent', '--sk-bg', 3.0],
];

const themes = readThemes(css);
let failures = 0;

for (const [name, vars] of Object.entries(themes)) {
  console.log(`\n${name.toUpperCase()}`);
  for (const [label, fgVar, bgVar, min] of PAIRS) {
    const fg = vars[fgVar];
    const bg = vars[bgVar];
    if (!fg || !bg) {
      console.log(`  ?  ${label.padEnd(30)} missing ${!fg ? fgVar : bgVar}`);
      failures++;
      continue;
    }
    const r = ratio(fg, bg);
    const pass = r >= min;
    if (!pass) failures++;
    console.log(`  ${pass ? 'ok' : 'FAIL'} ${label.padEnd(30)} ${r.toFixed(2)}:1 (need ${min}) ${fg} on ${bg}`);
  }
}

console.log(failures === 0
  ? '\nAll theme colour pairs meet their target contrast.'
  : `\n${failures} pair(s) below target.`);
process.exit(failures === 0 ? 0 : 1);
