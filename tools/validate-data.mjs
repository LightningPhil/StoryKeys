/**
 * Static schema and integrity validator for StoryKeys curriculum & badge JSON.
 *
 * Usage: node tools/validate-data.mjs
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const DATA_DIR = join(ROOT, 'public', 'data');
const STAGES = ['KS1', 'KS2', 'KS3', 'KS4'];

const failures = [];
function fail(msg) {
  failures.push(msg);
}

function readJson(relPath) {
  const full = join(DATA_DIR, relPath);
  if (!existsSync(full)) {
    fail(`Missing required file: public/data/${relPath}`);
    return null;
  }
  try {
    return JSON.parse(readFileSync(full, 'utf8'));
  } catch (err) {
    fail(`Invalid JSON in public/data/${relPath}: ${err.message}`);
    return null;
  }
}

function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0;
}

function isNonEmptyStringArray(v) {
  return Array.isArray(v) && v.length > 0 && v.every((item) => isNonEmptyString(item));
}

function checkUniqueIds(poolName, items) {
  const seen = new Set();
  for (const [idx, item] of items.entries()) {
    if (!item || typeof item !== 'object') {
      fail(`${poolName}[${idx}]: entry is not an object`);
      continue;
    }
    if (!isNonEmptyString(item.id)) {
      fail(`${poolName}[${idx}]: missing string id`);
      continue;
    }
    if (seen.has(item.id)) {
      fail(`${poolName}: duplicate id "${item.id}"`);
    }
    seen.add(item.id);
  }
}

// 1. Legacy duplicate tree check
if (existsSync(join(ROOT, 'data'))) {
  fail('Legacy root data/ directory still exists; public/data/ must be the single source of truth');
}

// 2. Stage datasets
const allPassages = [];
const allWordsets = [];
const allPatterns = [];

for (const stage of STAGES) {
  const passages = readJson(`${stage}/passages.json`);
  if (Array.isArray(passages)) {
    allPassages.push(...passages);
    for (const [i, p] of passages.entries()) {
      if (p.stage !== stage) fail(`${stage}/passages.json[${i}] (${p.id}): expected stage "${stage}", got "${p.stage}"`);
      if (!isNonEmptyString(p.title)) fail(`${stage}/passages.json[${i}] (${p.id}): missing title`);
      if (!isNonEmptyString(p.text)) fail(`${stage}/passages.json[${i}] (${p.id}): missing text`);
    }
  }

  const wordsets = readJson(`${stage}/wordsets.json`);
  if (Array.isArray(wordsets)) {
    allWordsets.push(...wordsets);
    for (const [i, w] of wordsets.entries()) {
      if (w.stage !== stage) fail(`${stage}/wordsets.json[${i}] (${w.id}): expected stage "${stage}", got "${w.stage}"`);
      if (!isNonEmptyString(w.name) && !isNonEmptyString(w.title)) {
        fail(`${stage}/wordsets.json[${i}] (${w.id}): missing name/title`);
      }
      if (!isNonEmptyStringArray(w.words)) {
        fail(`${stage}/wordsets.json[${i}] (${w.id}): missing non-empty words[]`);
      }
    }
  }

  const patterns = readJson(`${stage}/patterns.json`);
  if (Array.isArray(patterns)) {
    allPatterns.push(...patterns);
    for (const [i, pat] of patterns.entries()) {
      if (pat.stage !== stage) fail(`${stage}/patterns.json[${i}] (${pat.id}): expected stage "${stage}", got "${pat.stage}"`);
      if (!isNonEmptyString(pat.name)) fail(`${stage}/patterns.json[${i}] (${pat.id}): missing name`);
      if (!isNonEmptyStringArray(pat.items)) {
        fail(`${stage}/patterns.json[${i}] (${pat.id}): missing non-empty items[]`);
      }
      if (!isNonEmptyStringArray(pat.tags?.phonics)) {
        fail(`${stage}/patterns.json[${i}] (${pat.id}): missing non-empty tags.phonics[]`);
      }
    }
  }
}

checkUniqueIds('passages', allPassages);
checkUniqueIds('wordsets', allWordsets);
checkUniqueIds('patterns', allPatterns);

// 3. Shared phonics & spelling datasets
const phonics = readJson('phonics.json');
if (Array.isArray(phonics)) {
  checkUniqueIds('phonics', phonics);
  for (const [i, ph] of phonics.entries()) {
    if (!isNonEmptyString(ph.title)) fail(`phonics.json[${i}] (${ph.id}): missing title`);
    if (!isNonEmptyString(ph.text)) fail(`phonics.json[${i}] (${ph.id}): missing text`);
  }
}

const spelling = readJson('spelling.json');
if (Array.isArray(spelling)) {
  checkUniqueIds('spelling', spelling);
  for (const [i, sp] of spelling.entries()) {
    if (!STAGES.includes(sp.stage)) fail(`spelling.json[${i}] (${sp.id}): invalid stage "${sp.stage}"`);
    if (!isNonEmptyString(sp.name) && !isNonEmptyString(sp.title)) {
      fail(`spelling.json[${i}] (${sp.id}): missing name/title`);
    }
    if (!isNonEmptyStringArray(sp.words)) {
      fail(`spelling.json[${i}] (${sp.id}): missing non-empty words[]`);
    }
  }
}

// 4. Badges schema, criteria parity, and prerequisite reachability
const badges = readJson('badges.json');
const badgesSource = readFileSync(join(ROOT, 'src', 'progress', 'badges.ts'), 'utf8');
const skipsCommentBadges = /badge\._comment\s*\|\|\s*!badge\.id/.test(badgesSource);
const criteriaMatch = badgesSource.match(/const criteria:\s*Record<string,\s*boolean>\s*=\s*\{([\s\S]*?)\};/);
const criteriaKeys = new Set(
  criteriaMatch ? [...criteriaMatch[1].matchAll(/^\s*([a-z0-9_]+):/gm)].map((m) => m[1]) : [],
);

if (Array.isArray(badges)) {
  checkUniqueIds('badges', badges);
  const badgeIds = new Set(badges.map((b) => b.id).filter(Boolean));

  for (const [i, b] of badges.entries()) {
    if (!isNonEmptyString(b.label)) fail(`badges.json[${i}] (${b.id}): missing label`);
    if (!isNonEmptyString(b.desc)) fail(`badges.json[${i}] (${b.id}): missing desc`);
    if (!isNonEmptyString(b.track)) fail(`badges.json[${i}] (${b.id}): missing track`);
    if (typeof b.tier !== 'number') fail(`badges.json[${i}] (${b.id}): missing numeric tier`);
    if ('_comment' in b && skipsCommentBadges) {
      fail(`badges.json[${i}] (${b.id}): _comment property causes src/progress/badges.ts to skip awarding`);
    }
    if (b.id && criteriaKeys.size > 0 && !criteriaKeys.has(b.id)) {
      fail(`badges.json[${i}] (${b.id}): no matching criterion in src/progress/badges.ts`);
    }
    const reqs = !b.requires ? [] : Array.isArray(b.requires) ? b.requires : [b.requires];
    for (const req of reqs) {
      if (!badgeIds.has(req)) {
        fail(`badges.json[${i}] (${b.id}): requires unknown badge "${req}"`);
      }
    }
  }

  for (const key of criteriaKeys) {
    if (!badgeIds.has(key)) {
      fail(`src/progress/badges.ts criterion "${key}" has no entry in badges.json`);
    }
  }

  // Simulate transitive prerequisite reachability
  const reachable = new Set();
  let progressed = true;
  while (progressed) {
    progressed = false;
    for (const b of badges) {
      if (!b.id || reachable.has(b.id)) continue;
      if (skipsCommentBadges && b._comment) continue;
      const reqs = !b.requires ? [] : Array.isArray(b.requires) ? b.requires : [b.requires];
      if (reqs.every((r) => reachable.has(r))) {
        reachable.add(b.id);
        progressed = true;
      }
    }
  }

  const unreachable = badges.filter((b) => b.id && !reachable.has(b.id)).map((b) => b.id);
  if (unreachable.length > 0) {
    fail(`Unreachable badges (${unreachable.length}/${badges.length}): ${unreachable.join(', ')}`);
  }
}

if (failures.length > 0) {
  console.error(`Data validation failed with ${failures.length} issue(s):`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}

console.log(
  `Data validation passed: ${allPassages.length} passages, ${allWordsets.length} wordsets, `
  + `${allPatterns.length} patterns, ${phonics?.length ?? 0} phonics, `
  + `${spelling?.length ?? 0} spelling sets, ${badges?.length ?? 0} badges.`,
);
