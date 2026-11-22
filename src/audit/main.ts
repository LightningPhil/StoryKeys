/**
 * StoryKeys Content Audit Dashboard
 * Typed utility for reviewing and exporting educational content.
 */

import type { jsPDF } from 'jspdf';
import { isStage, STAGES } from '../types';
import type { BadgeDefinition, Passage, PatternPack, Stage, Wordset } from '../types';
import { escapeHtml } from '../utils';

interface StageContent {
  passages: Passage[];
  patterns: PatternPack[];
  wordsets: Wordset[];
}

interface AuditDataStore {
  badges: BadgeDefinition[];
  phonics: Passage[];
  spelling: Wordset[];
  keyStages: Record<Stage, StageContent>;
}

const dataStore: AuditDataStore = {
  badges: [],
  phonics: [],
  spelling: [],
  keyStages: {
    KS1: { passages: [], patterns: [], wordsets: [] },
    KS2: { passages: [], patterns: [], wordsets: [] },
    KS3: { passages: [], patterns: [], wordsets: [] },
    KS4: { passages: [], patterns: [], wordsets: [] },
  },
};

const AGE_RANGES: Record<Stage, string> = {
  KS1: 'Ages 5-7',
  KS2: 'Ages 7-11',
  KS3: 'Ages 11-14',
  KS4: 'Ages 14-16',
};

const PDF_CONFIG = {
  margin: 20,
  lineHeight: 7,
  titleSize: 18,
  headingSize: 14,
  subheadingSize: 11,
  bodySize: 10,
  smallSize: 8,
  pageWidth: 210,
  pageHeight: 297,
} as const;

function setText(id: string, value: string | number): void {
  const el = document.getElementById(id);
  if (el) el.textContent = String(value);
}

async function fetchJSON<T>(path: string): Promise<T> {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`Failed to load ${path}: ${response.status}`);
  return response.json() as Promise<T>;
}

async function loadAllData(): Promise<void> {
  const [rawBadges, phonics, spelling] = await Promise.all([
    fetchJSON<Array<Partial<BadgeDefinition>>>('/data/badges.json'),
    fetchJSON<Passage[]>('/data/phonics.json'),
    fetchJSON<Wordset[]>('/data/spelling.json'),
  ]);

  dataStore.badges = rawBadges.filter((b): b is BadgeDefinition => Boolean(b.id));
  dataStore.phonics = phonics;
  dataStore.spelling = spelling;

  await Promise.all(
    STAGES.map(async (ks) => {
      const [passages, patterns, wordsets] = await Promise.all([
        fetchJSON<Passage[]>(`/data/${ks}/passages.json`),
        fetchJSON<PatternPack[]>(`/data/${ks}/patterns.json`),
        fetchJSON<Wordset[]>(`/data/${ks}/wordsets.json`),
      ]);
      dataStore.keyStages[ks] = { passages, patterns, wordsets };
    }),
  );
}

function updateDashboard(): void {
  let totalPassages = 0;
  let totalPatterns = 0;
  let totalWordsets = 0;

  for (const ks of STAGES) {
    const data = dataStore.keyStages[ks];
    totalPassages += data.passages.length;
    totalPatterns += data.patterns.length;
    totalWordsets += data.wordsets.length;

    const prefix = ks.toLowerCase();
    setText(`${prefix}Passages`, data.passages.length);
    setText(`${prefix}Patterns`, data.patterns.length);
    setText(`${prefix}Wordsets`, data.wordsets.length);

    const themes = [...new Set(data.passages.map((p) => p.theme).filter((t): t is string => Boolean(t)))];
    const themesEl = document.getElementById(`${prefix}Themes`);
    if (themesEl) {
      themesEl.innerHTML = themes.length > 0
        ? themes.map((t) => `<span class="theme-tag">${escapeHtml(t)}</span>`).join('')
        : '<span class="theme-tag">No themes</span>';
    }
  }

  setText('totalPassages', totalPassages);
  setText('totalPatterns', totalPatterns);
  setText('totalWordsets', totalWordsets);
  setText('totalBadges', dataStore.badges.length);
  setText('totalPhonics', dataStore.phonics.length);
  setText('totalSpelling', dataStore.spelling.length);

  updateBadgesSection();
  updatePhonicsSection();
  updateSpellingSection();
}

function updateBadgesSection(): void {
  const badges = dataStore.badges;
  const tracks: Record<string, number> = {};

  for (const badge of badges) {
    if (badge.track) {
      tracks[badge.track] = (tracks[badge.track] || 0) + 1;
    }
  }

  const statsEl = document.getElementById('badgeStats');
  if (!statsEl) return;
  statsEl.innerHTML = `
        <div class="stat-row">
            <span>Total Badges</span>
            <span>${badges.length}</span>
        </div>
        <div class="stat-row">
            <span>Unique Tracks</span>
            <span>${Object.keys(tracks).length}</span>
        </div>
        <p style="margin-top: 1rem; font-weight: 500;">Badges by Track:</p>
        <div class="track-breakdown">
            ${Object.entries(tracks).map(([track, count]) => `
                <div class="track-item">
                    <span class="track-name">${escapeHtml(track)}</span>
                    <span class="track-count">${count}</span>
                </div>
            `).join('')}
        </div>
    `;
}

function updatePhonicsSection(): void {
  const phonics = dataStore.phonics;
  let totalChars = 0;

  for (const p of phonics) {
    if (p.text) totalChars += p.text.length;
  }

  const avgChars = phonics.length > 0 ? Math.round(totalChars / phonics.length) : 0;

  const statsEl = document.getElementById('phonicsStats');
  if (!statsEl) return;
  statsEl.innerHTML = `
        <div class="stat-row">
            <span>Total Phonics Lessons</span>
            <span>${phonics.length}</span>
        </div>
        <div class="stat-row">
            <span>Average Characters per Lesson</span>
            <span>${avgChars}</span>
        </div>
        <div class="stat-row">
            <span>Total Characters</span>
            <span>${escapeHtml(totalChars.toLocaleString())}</span>
        </div>
    `;
}

function updateSpellingSection(): void {
  const spelling = dataStore.spelling;
  const stages: Record<Stage, number> = { KS1: 0, KS2: 0, KS3: 0, KS4: 0 };
  const themes = new Set<string>();
  let totalWords = 0;

  for (const s of spelling) {
    if (s.stage && isStage(s.stage)) {
      stages[s.stage]++;
    }
    if (s.theme) themes.add(s.theme);
    if (s.words) totalWords += s.words.length;
  }

  const statsEl = document.getElementById('spellingStats');
  if (!statsEl) return;
  statsEl.innerHTML = `
        <div class="stat-row">
            <span>Total Spelling Sets</span>
            <span>${spelling.length}</span>
        </div>
        <div class="stat-row">
            <span>Total Words</span>
            <span>${escapeHtml(totalWords.toLocaleString())}</span>
        </div>
        <div class="stat-row">
            <span>Unique Themes</span>
            <span>${themes.size}</span>
        </div>
        <p style="margin-top: 1rem; font-weight: 500;">Sets by Key Stage:</p>
        <div class="track-breakdown">
            ${Object.entries(stages).map(([stage, count]) => `
                <div class="track-item">
                    <span class="track-name">${escapeHtml(stage)}</span>
                    <span class="track-count">${count}</span>
                </div>
            `).join('')}
        </div>
    `;
}

function groupBy<T>(items: T[], getKey: (item: T) => string | undefined): Record<string, T[]> {
  const grouped: Record<string, T[]> = {};
  for (const item of items) {
    const key = getKey(item) || 'Other';
    const bucket = grouped[key] ?? (grouped[key] = []);
    bucket.push(item);
  }
  return grouped;
}

// ============================================
// PDF Generation Helpers (lazy bundled jsPDF)
// ============================================

async function createPDF(): Promise<jsPDF> {
  const { jsPDF: JsPdfCtor } = await import('jspdf');
  const doc = new JsPdfCtor();
  doc.setFont('helvetica');
  return doc;
}

function addHeader(doc: jsPDF, title: string, subtitle = ''): number {
  const cfg = PDF_CONFIG;
  doc.setFillColor(45, 45, 45);
  doc.rect(0, 0, cfg.pageWidth, 35, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(cfg.titleSize);
  doc.setFont('helvetica', 'bold');
  doc.text(title, cfg.margin, 20);

  if (subtitle) {
    doc.setFontSize(cfg.bodySize);
    doc.setFont('helvetica', 'normal');
    doc.text(subtitle, cfg.margin, 28);
  }

  doc.setTextColor(0, 0, 0);
  return 45;
}

function addSectionHeader(doc: jsPDF, y: number, text: string): number {
  const cfg = PDF_CONFIG;
  let nextY = y;
  if (nextY > cfg.pageHeight - 40) {
    doc.addPage();
    nextY = cfg.margin;
  }

  doc.setFillColor(64, 64, 64);
  doc.rect(cfg.margin, nextY - 5, cfg.pageWidth - cfg.margin * 2, 10, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(cfg.headingSize);
  doc.setFont('helvetica', 'bold');
  doc.text(text, cfg.margin + 5, nextY + 2);
  doc.setTextColor(0, 0, 0);

  return nextY + 15;
}

function addSubheading(doc: jsPDF, y: number, text: string): number {
  const cfg = PDF_CONFIG;
  let nextY = y;
  if (nextY > cfg.pageHeight - 30) {
    doc.addPage();
    nextY = cfg.margin;
  }

  doc.setFontSize(cfg.subheadingSize);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(64, 64, 64);
  doc.text(text, cfg.margin, nextY);
  doc.setTextColor(0, 0, 0);

  return nextY + cfg.lineHeight;
}

function addText(doc: jsPDF, y: number, text: string, indent = 0): number {
  const cfg = PDF_CONFIG;
  const maxWidth = cfg.pageWidth - cfg.margin * 2 - indent;
  let nextY = y;

  doc.setFontSize(cfg.bodySize);
  doc.setFont('helvetica', 'normal');

  const lines: string[] = doc.splitTextToSize(text, maxWidth);
  for (const line of lines) {
    if (nextY > cfg.pageHeight - cfg.margin) {
      doc.addPage();
      nextY = cfg.margin;
    }
    doc.text(line, cfg.margin + indent, nextY);
    nextY += cfg.lineHeight;
  }

  return nextY;
}

function addSmallText(doc: jsPDF, y: number, text: string, indent = 0): number {
  const cfg = PDF_CONFIG;
  let nextY = y;
  doc.setFontSize(cfg.smallSize);
  doc.setTextColor(100, 100, 100);

  if (nextY > cfg.pageHeight - cfg.margin) {
    doc.addPage();
    nextY = cfg.margin;
  }

  doc.text(text, cfg.margin + indent, nextY);
  doc.setTextColor(0, 0, 0);
  return nextY + cfg.lineHeight;
}

function addDivider(doc: jsPDF, y: number): number {
  const cfg = PDF_CONFIG;
  doc.setDrawColor(200, 200, 200);
  doc.line(cfg.margin, y, cfg.pageWidth - cfg.margin, y);
  return y + 5;
}

function addFooter(doc: jsPDF): void {
  const pageCount = doc.getNumberOfPages();
  const cfg = PDF_CONFIG;

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(cfg.smallSize);
    doc.setTextColor(128, 128, 128);
    doc.text(
      `StoryKeys Content Audit • Page ${i} of ${pageCount} • Generated ${new Date().toLocaleDateString('en-GB')}`,
      cfg.pageWidth / 2,
      cfg.pageHeight - 10,
      { align: 'center' },
    );
  }
}

async function generatePDF(keyStage: Stage): Promise<void> {
  const doc = await createPDF();
  const data = dataStore.keyStages[keyStage];
  const cfg = PDF_CONFIG;

  let y = addHeader(doc, `${keyStage} Content Review`, `${AGE_RANGES[keyStage]} • StoryKeys Educational Content`);
  y = addSectionHeader(doc, y, 'Content Statistics');
  y = addText(doc, y, `Passages: ${data.passages.length} | Patterns: ${data.patterns.length} | Wordsets: ${data.wordsets.length}`);
  y += 5;

  y = addSectionHeader(doc, y, 'PASSAGES');
  const passagesByTheme = groupBy(data.passages, (p) => p.theme);

  for (const [theme, passages] of Object.entries(passagesByTheme)) {
    y = addSubheading(doc, y, `Theme: ${theme || 'Unthemed'}`);
    for (const passage of passages) {
      if (y > cfg.pageHeight - 60) {
        doc.addPage();
        y = cfg.margin;
      }
      doc.setFontSize(cfg.bodySize);
      doc.setFont('helvetica', 'bold');
      doc.text(`• ${passage.title || passage.id}`, cfg.margin + 5, y);
      y += cfg.lineHeight;
      doc.setFont('helvetica', 'normal');
      y = addText(doc, y, passage.text, 10);
      y = addSmallText(doc, y, `ID: ${passage.id} | Chars: ${passage.text?.length || 0}`, 10);
      y += 3;
    }
    y += 5;
  }

  doc.addPage();
  y = cfg.margin;
  y = addSectionHeader(doc, y, 'PATTERNS');
  for (const pattern of data.patterns) {
    if (y > cfg.pageHeight - 40) {
      doc.addPage();
      y = cfg.margin;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(cfg.bodySize);
    doc.text(`• ${pattern.name || pattern.id}`, cfg.margin + 5, y);
    y += cfg.lineHeight;
    doc.setFont('helvetica', 'normal');
    y = addText(doc, y, `Words: ${pattern.items?.join(', ') || 'N/A'}`, 10);
    y = addSmallText(doc, y, `ID: ${pattern.id}`, 10);
    y += 5;
  }

  doc.addPage();
  y = cfg.margin;
  y = addSectionHeader(doc, y, 'WORDSETS');
  const wordsetsByTheme = groupBy(data.wordsets, (w) => w.theme);
  for (const [theme, wordsets] of Object.entries(wordsetsByTheme)) {
    y = addSubheading(doc, y, `Theme: ${theme || 'Unthemed'}`);
    for (const wordset of wordsets) {
      if (y > cfg.pageHeight - 40) {
        doc.addPage();
        y = cfg.margin;
      }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(cfg.bodySize);
      doc.text(`• ${wordset.name || wordset.id}`, cfg.margin + 5, y);
      y += cfg.lineHeight;
      doc.setFont('helvetica', 'normal');
      y = addText(doc, y, `Words: ${wordset.words?.join(', ') || 'N/A'}`, 10);
      y = addSmallText(doc, y, `ID: ${wordset.id}`, 10);
      y += 5;
    }
  }

  addFooter(doc);
  doc.save(`StoryKeys_${keyStage}_Content_Review.pdf`);
}

async function generateBadgesPDF(): Promise<void> {
  const doc = await createPDF();
  const badges = dataStore.badges;
  const cfg = PDF_CONFIG;

  let y = addHeader(doc, 'Badges Content Review', 'StoryKeys Achievement System');
  y = addSectionHeader(doc, y, 'Statistics');
  const tracks = new Set(badges.map((b) => b.track).filter(Boolean));
  y = addText(doc, y, `Total Badges: ${badges.length}`);
  y = addText(doc, y, `Tracks: ${Array.from(tracks).join(', ')}`);
  y += 5;

  const badgesByTrack = groupBy(badges, (b) => b.track);
  for (const [track, trackBadges] of Object.entries(badgesByTrack)) {
    y = addSectionHeader(doc, y, `Track: ${track?.toUpperCase() || 'UNASSIGNED'}`);
    const sorted = [...trackBadges].sort((a, b) => (a.tier || 0) - (b.tier || 0));
    for (const badge of sorted) {
      if (y > cfg.pageHeight - 40) {
        doc.addPage();
        y = cfg.margin;
      }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(cfg.bodySize);
      doc.text(`• ${badge.label || badge.id}`, cfg.margin + 5, y);
      if (badge.tier) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(cfg.smallSize);
        doc.text(`[Tier ${badge.tier}]`, cfg.margin + 100, y);
      }
      y += cfg.lineHeight;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(cfg.bodySize);
      y = addText(doc, y, badge.desc || 'No description', 10);
      const reqText = Array.isArray(badge.requires) ? badge.requires.join(', ') : badge.requires;
      y = addSmallText(doc, y, `ID: ${badge.id}${reqText ? ` | Requires: ${reqText}` : ''}`, 10);
      y += 3;
    }
  }

  addFooter(doc);
  doc.save('StoryKeys_Badges_Review.pdf');
}

async function generatePhonicsPDF(): Promise<void> {
  const doc = await createPDF();
  const phonics = dataStore.phonics;
  const cfg = PDF_CONFIG;

  let y = addHeader(doc, 'Phonics Lessons Review', 'StoryKeys Educational Content');
  y = addSectionHeader(doc, y, 'Statistics');
  const totalChars = phonics.reduce((sum, p) => sum + (p.text?.length || 0), 0);
  y = addText(doc, y, `Total Lessons: ${phonics.length}`);
  y = addText(doc, y, `Total Characters: ${totalChars.toLocaleString()}`);
  y = addText(doc, y, `Average Length: ${phonics.length > 0 ? Math.round(totalChars / phonics.length) : 0} characters`);
  y += 5;

  y = addSectionHeader(doc, y, 'All Phonics Lessons');
  for (const lesson of phonics) {
    if (y > cfg.pageHeight - 60) {
      doc.addPage();
      y = cfg.margin;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(cfg.bodySize);
    doc.text(`• ${lesson.title || lesson.id}`, cfg.margin + 5, y);
    y += cfg.lineHeight;
    doc.setFont('helvetica', 'normal');
    y = addText(doc, y, lesson.text, 10);
    const phonicsTags = lesson.tags?.phonics?.join(', ') || 'N/A';
    y = addSmallText(doc, y, `ID: ${lesson.id} | Tags: ${phonicsTags} | Chars: ${lesson.text?.length || 0}`, 10);
    y = addDivider(doc, y);
    y += 3;
  }

  addFooter(doc);
  doc.save('StoryKeys_Phonics_Review.pdf');
}

async function generateSpellingPDF(): Promise<void> {
  const doc = await createPDF();
  const spelling = dataStore.spelling;
  const cfg = PDF_CONFIG;

  let y = addHeader(doc, 'Spelling Sets Review', 'StoryKeys Educational Content');
  y = addSectionHeader(doc, y, 'Statistics');
  const totalWords = spelling.reduce((sum, s) => sum + (s.words?.length || 0), 0);
  y = addText(doc, y, `Total Spelling Sets: ${spelling.length}`);
  y = addText(doc, y, `Total Words: ${totalWords.toLocaleString()}`);
  y += 5;

  const spellingByStage = groupBy(spelling, (s) => s.stage);
  for (const stage of STAGES) {
    const stageSets = spellingByStage[stage] || [];
    if (stageSets.length === 0) continue;

    y = addSectionHeader(doc, y, `${stage} Spelling Sets`);
    const byTheme = groupBy(stageSets, (s) => s.theme);
    for (const [theme, sets] of Object.entries(byTheme)) {
      y = addSubheading(doc, y, `Theme: ${theme || 'General'}`);
      for (const set of sets) {
        if (y > cfg.pageHeight - 40) {
          doc.addPage();
          y = cfg.margin;
        }
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(cfg.bodySize);
        doc.text(`• ${set.name || set.id}`, cfg.margin + 5, y);
        y += cfg.lineHeight;
        doc.setFont('helvetica', 'normal');
        y = addText(doc, y, `Words: ${set.words?.join(', ') || 'N/A'}`, 10);
        y = addSmallText(doc, y, `ID: ${set.id} | Word count: ${set.words?.length || 0}`, 10);
        y += 3;
      }
      y += 3;
    }
  }

  addFooter(doc);
  doc.save('StoryKeys_Spelling_Review.pdf');
}

async function generateAllKeyStagesPDF(): Promise<void> {
  const doc = await createPDF();
  const cfg = PDF_CONFIG;

  let y = addHeader(doc, 'All Key Stages Content Review', 'StoryKeys Complete Passages, Patterns & Wordsets');
  y = addSectionHeader(doc, y, 'Overview');
  let totalP = 0;
  let totalPat = 0;
  let totalW = 0;
  for (const ks of STAGES) {
    const d = dataStore.keyStages[ks];
    totalP += d.passages.length;
    totalPat += d.patterns.length;
    totalW += d.wordsets.length;
  }
  y = addText(doc, y, `Total Passages: ${totalP} | Total Patterns: ${totalPat} | Total Wordsets: ${totalW}`);
  y += 5;

  for (const ks of STAGES) {
    const data = dataStore.keyStages[ks];
    doc.addPage();
    doc.setFillColor(45, 45, 45);
    doc.rect(0, 0, cfg.pageWidth, 25, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(`${ks} Content (${AGE_RANGES[ks]})`, cfg.margin, 16);
    doc.setTextColor(0, 0, 0);
    y = 35;

    y = addSectionHeader(doc, y, 'Passages');
    for (const passage of data.passages) {
      if (y > cfg.pageHeight - 50) {
        doc.addPage();
        y = cfg.margin;
      }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(cfg.bodySize);
      doc.text(`• ${passage.title || passage.id}`, cfg.margin + 5, y);
      y += cfg.lineHeight;
      doc.setFont('helvetica', 'normal');
      y = addText(doc, y, passage.text, 10);
      y += 3;
    }

    doc.addPage();
    y = cfg.margin;
    y = addSectionHeader(doc, y, 'Patterns');
    for (const pattern of data.patterns) {
      if (y > cfg.pageHeight - 30) {
        doc.addPage();
        y = cfg.margin;
      }
      doc.setFont('helvetica', 'bold');
      doc.text(`• ${pattern.name}`, cfg.margin + 5, y);
      y += cfg.lineHeight;
      y = addText(doc, y, `Words: ${pattern.items?.join(', ')}`, 10);
      y += 3;
    }

    doc.addPage();
    y = cfg.margin;
    y = addSectionHeader(doc, y, 'Wordsets');
    for (const wordset of data.wordsets) {
      if (y > cfg.pageHeight - 30) {
        doc.addPage();
        y = cfg.margin;
      }
      doc.setFont('helvetica', 'bold');
      doc.text(`• ${wordset.name || wordset.id}`, cfg.margin + 5, y);
      y += cfg.lineHeight;
      y = addText(doc, y, `Words: ${wordset.words?.join(', ')}`, 10);
      y += 3;
    }
  }

  addFooter(doc);
  doc.save('StoryKeys_All_KeyStages_Review.pdf');
}

async function generateCompletePDF(): Promise<void> {
  const doc = await createPDF();
  const cfg = PDF_CONFIG;

  let y = addHeader(doc, 'Complete Content Review', 'StoryKeys - All Educational Content for Suitability Review');
  y = addSectionHeader(doc, y, 'Contents');
  y = addText(doc, y, '1. Overview Statistics');
  y = addText(doc, y, '2. Key Stage Content (KS1-KS4)');
  y = addText(doc, y, '3. Badges & Achievements');
  y = addText(doc, y, '4. Phonics Lessons');
  y = addText(doc, y, '5. Spelling Sets');

  doc.addPage();
  y = cfg.margin;
  y = addSectionHeader(doc, y, '1. OVERVIEW STATISTICS');

  let totalP = 0;
  let totalPat = 0;
  let totalW = 0;
  for (const ks of STAGES) {
    const d = dataStore.keyStages[ks];
    totalP += d.passages.length;
    totalPat += d.patterns.length;
    totalW += d.wordsets.length;
    y = addText(doc, y, `${ks}: ${d.passages.length} passages, ${d.patterns.length} patterns, ${d.wordsets.length} wordsets`);
  }
  y += 5;
  y = addText(doc, y, `Total Passages: ${totalP}`);
  y = addText(doc, y, `Total Patterns: ${totalPat}`);
  y = addText(doc, y, `Total Wordsets: ${totalW}`);
  y = addText(doc, y, `Total Badges: ${dataStore.badges.length}`);
  y = addText(doc, y, `Total Phonics Lessons: ${dataStore.phonics.length}`);
  y = addText(doc, y, `Total Spelling Sets: ${dataStore.spelling.length}`);

  for (const ks of STAGES) {
    const data = dataStore.keyStages[ks];
    doc.addPage();
    doc.setFillColor(45, 45, 45);
    doc.rect(0, 0, cfg.pageWidth, 20, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(`2. KEY STAGE: ${ks} (${AGE_RANGES[ks]})`, cfg.margin, 14);
    doc.setTextColor(0, 0, 0);
    y = 30;

    y = addSubheading(doc, y, 'Passages');
    for (const passage of data.passages) {
      if (y > cfg.pageHeight - 50) {
        doc.addPage();
        y = cfg.margin;
      }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text(`${passage.title || passage.id}`, cfg.margin + 5, y);
      y += 5;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      const lines = doc.splitTextToSize(passage.text, cfg.pageWidth - 40);
      for (const line of lines) {
        if (y > cfg.pageHeight - 15) {
          doc.addPage();
          y = cfg.margin;
        }
        doc.text(line, cfg.margin + 5, y);
        y += 4;
      }
      y += 3;
    }
  }

  doc.addPage();
  y = cfg.margin;
  y = addSectionHeader(doc, y, '3. BADGES & ACHIEVEMENTS');
  const badgesByTrack = groupBy(dataStore.badges, (b) => b.track);
  for (const [track, badges] of Object.entries(badgesByTrack)) {
    y = addSubheading(doc, y, `Track: ${track || 'Unassigned'}`);
    for (const badge of badges) {
      if (y > cfg.pageHeight - 25) {
        doc.addPage();
        y = cfg.margin;
      }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text(`• ${badge.label} (Tier ${badge.tier || '-'})`, cfg.margin + 5, y);
      y += 5;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.text(badge.desc || '', cfg.margin + 10, y);
      y += 6;
    }
  }

  doc.addPage();
  y = cfg.margin;
  y = addSectionHeader(doc, y, '4. PHONICS LESSONS');
  for (const lesson of dataStore.phonics) {
    if (y > cfg.pageHeight - 50) {
      doc.addPage();
      y = cfg.margin;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(`${lesson.title || lesson.id}`, cfg.margin + 5, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    const lines = doc.splitTextToSize(lesson.text, cfg.pageWidth - 40);
    for (const line of lines) {
      if (y > cfg.pageHeight - 15) {
        doc.addPage();
        y = cfg.margin;
      }
      doc.text(line, cfg.margin + 5, y);
      y += 4;
    }
    y += 4;
  }

  doc.addPage();
  y = cfg.margin;
  y = addSectionHeader(doc, y, '5. SPELLING SETS');
  const spellingByStage = groupBy(dataStore.spelling, (s) => s.stage);
  for (const stage of STAGES) {
    const sets = spellingByStage[stage] || [];
    if (sets.length === 0) continue;

    y = addSubheading(doc, y, `${stage} Spelling`);
    for (const set of sets) {
      if (y > cfg.pageHeight - 25) {
        doc.addPage();
        y = cfg.margin;
      }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text(`• ${set.name || set.id}`, cfg.margin + 5, y);
      y += 5;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.text(`Words: ${set.words?.join(', ')}`, cfg.margin + 10, y);
      y += 6;
    }
  }

  addFooter(doc);
  doc.save('StoryKeys_Complete_Content_Review.pdf');
}

function bindAuditButtons(): void {
  document.querySelectorAll<HTMLButtonElement>('[data-pdf-stage]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const stage = btn.dataset.pdfStage;
      if (isStage(stage)) void generatePDF(stage);
    });
  });

  document.getElementById('pdf-badges-btn')?.addEventListener('click', () => { void generateBadgesPDF(); });
  document.getElementById('pdf-phonics-btn')?.addEventListener('click', () => { void generatePhonicsPDF(); });
  document.getElementById('pdf-spelling-btn')?.addEventListener('click', () => { void generateSpellingPDF(); });
  document.getElementById('pdf-all-stages-btn')?.addEventListener('click', () => { void generateAllKeyStagesPDF(); });
  document.getElementById('pdf-complete-btn')?.addEventListener('click', () => { void generateCompletePDF(); });
}

async function initAudit(): Promise<void> {
  setText(
    'generatedDate',
    new Date().toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }),
  );

  bindAuditButtons();

  try {
    await loadAllData();
    updateDashboard();
  } catch (error) {
    console.error('Error loading audit data:', error);
    const summaryEl = document.getElementById('summaryStats');
    if (summaryEl) {
      summaryEl.innerHTML = '<p>Error loading data files. Please ensure StoryKeys is served over HTTP.</p>';
    }
  }
}

void initAudit();
