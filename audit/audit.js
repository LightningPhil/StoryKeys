/**
 * StoryKeys Content Audit Dashboard
 * Utility for reviewing and exporting educational content
 */

// Data storage
let dataStore = {
    badges: [],
    phonics: [],
    spelling: [],
    keyStages: {
        KS1: { passages: [], patterns: [], wordsets: [] },
        KS2: { passages: [], patterns: [], wordsets: [] },
        KS3: { passages: [], patterns: [], wordsets: [] },
        KS4: { passages: [], patterns: [], wordsets: [] }
    }
};

// Initialize on page load
document.addEventListener('DOMContentLoaded', async () => {
    document.getElementById('generatedDate').textContent = new Date().toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });

    await loadAllData();
    updateDashboard();
});

// Load all data files
async function loadAllData() {
    try {
        // Load main data files
        const [badges, phonics, spelling] = await Promise.all([
            fetchJSON('data/badges.json'),
            fetchJSON('data/phonics.json'),
            fetchJSON('data/spelling.json')
        ]);

        dataStore.badges = badges;
        dataStore.phonics = phonics;
        dataStore.spelling = spelling;

        // Load key stage data
        for (const ks of ['KS1', 'KS2', 'KS3', 'KS4']) {
            const [passages, patterns, wordsets] = await Promise.all([
                fetchJSON(`data/${ks}/passages.json`),
                fetchJSON(`data/${ks}/patterns.json`),
                fetchJSON(`data/${ks}/wordsets.json`)
            ]);

            dataStore.keyStages[ks] = { passages, patterns, wordsets };
        }

        console.log('All data loaded successfully');
    } catch (error) {
        console.error('Error loading data:', error);
        alert('Error loading data files. Please ensure you are running this from a local server.');
    }
}

async function fetchJSON(path) {
    const response = await fetch(path);
    if (!response.ok) throw new Error(`Failed to load ${path}`);
    return response.json();
}

// Update dashboard with loaded data
function updateDashboard() {
    // Summary stats
    let totalPassages = 0, totalPatterns = 0, totalWordsets = 0;

    for (const ks of ['KS1', 'KS2', 'KS3', 'KS4']) {
        const data = dataStore.keyStages[ks];
        totalPassages += data.passages.length;
        totalPatterns += data.patterns.length;
        totalWordsets += data.wordsets.length;

        // Update individual KS stats
        document.getElementById(`${ks.toLowerCase()}Passages`).textContent = data.passages.length;
        document.getElementById(`${ks.toLowerCase()}Patterns`).textContent = data.patterns.length;
        document.getElementById(`${ks.toLowerCase()}Wordsets`).textContent = data.wordsets.length;

        // Extract and display themes
        const themes = [...new Set(data.passages.map(p => p.theme).filter(Boolean))];
        const themesEl = document.getElementById(`${ks.toLowerCase()}Themes`);
        themesEl.innerHTML = themes.length > 0 
            ? themes.map(t => `<span class="theme-tag">${t}</span>`).join('')
            : '<span class="theme-tag">No themes</span>';
    }

    document.getElementById('totalPassages').textContent = totalPassages;
    document.getElementById('totalPatterns').textContent = totalPatterns;
    document.getElementById('totalWordsets').textContent = totalWordsets;
    document.getElementById('totalBadges').textContent = dataStore.badges.length;
    document.getElementById('totalPhonics').textContent = dataStore.phonics.length;
    document.getElementById('totalSpelling').textContent = dataStore.spelling.length;

    // Update badges section
    updateBadgesSection();

    // Update phonics section
    updatePhonicsSection();

    // Update spelling section
    updateSpellingSection();
}

function updateBadgesSection() {
    const badges = dataStore.badges;
    const tracks = {};
    const tiers = {};

    badges.forEach(badge => {
        if (badge.track) {
            tracks[badge.track] = (tracks[badge.track] || 0) + 1;
        }
        if (badge.tier) {
            tiers[badge.tier] = (tiers[badge.tier] || 0) + 1;
        }
    });

    const statsEl = document.getElementById('badgeStats');
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
                    <span class="track-name">${track}</span>
                    <span class="track-count">${count}</span>
                </div>
            `).join('')}
        </div>
    `;
}

function updatePhonicsSection() {
    const phonics = dataStore.phonics;
    const themes = {};
    let totalChars = 0;

    phonics.forEach(p => {
        if (p.theme) themes[p.theme] = (themes[p.theme] || 0) + 1;
        if (p.meta?.est_chars) totalChars += p.meta.est_chars;
    });

    const avgChars = phonics.length > 0 ? Math.round(totalChars / phonics.length) : 0;

    const statsEl = document.getElementById('phonicsStats');
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
            <span>${totalChars.toLocaleString()}</span>
        </div>
    `;
}

function updateSpellingSection() {
    const spelling = dataStore.spelling;
    const stages = { KS1: 0, KS2: 0, KS3: 0, KS4: 0 };
    const themes = {};
    let totalWords = 0;

    spelling.forEach(s => {
        if (s.stage && stages.hasOwnProperty(s.stage)) {
            stages[s.stage]++;
        }
        if (s.theme) themes[s.theme] = (themes[s.theme] || 0) + 1;
        if (s.words) totalWords += s.words.length;
    });

    const statsEl = document.getElementById('spellingStats');
    statsEl.innerHTML = `
        <div class="stat-row">
            <span>Total Spelling Sets</span>
            <span>${spelling.length}</span>
        </div>
        <div class="stat-row">
            <span>Total Words</span>
            <span>${totalWords.toLocaleString()}</span>
        </div>
        <div class="stat-row">
            <span>Unique Themes</span>
            <span>${Object.keys(themes).length}</span>
        </div>
        <p style="margin-top: 1rem; font-weight: 500;">Sets by Key Stage:</p>
        <div class="track-breakdown">
            ${Object.entries(stages).map(([stage, count]) => `
                <div class="track-item">
                    <span class="track-name">${stage}</span>
                    <span class="track-count">${count}</span>
                </div>
            `).join('')}
        </div>
    `;
}

// ============================================
// PDF Generation Functions
// ============================================

const { jsPDF } = window.jspdf;

// PDF Configuration
const PDF_CONFIG = {
    margin: 20,
    lineHeight: 7,
    titleSize: 18,
    headingSize: 14,
    subheadingSize: 11,
    bodySize: 10,
    smallSize: 8,
    pageWidth: 210,
    pageHeight: 297
};

function createPDF(title) {
    const doc = new jsPDF();
    doc.setFont('helvetica');
    return doc;
}

function addHeader(doc, title, subtitle = '') {
    const cfg = PDF_CONFIG;

    // Header background
    doc.setFillColor(45, 45, 45);
    doc.rect(0, 0, cfg.pageWidth, 35, 'F');

    // Title
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(cfg.titleSize);
    doc.setFont('helvetica', 'bold');
    doc.text(title, cfg.margin, 20);

    // Subtitle
    if (subtitle) {
        doc.setFontSize(cfg.bodySize);
        doc.setFont('helvetica', 'normal');
        doc.text(subtitle, cfg.margin, 28);
    }

    // Reset
    doc.setTextColor(0, 0, 0);
    return 45;
}

function addSectionHeader(doc, y, text) {
    const cfg = PDF_CONFIG;

    if (y > cfg.pageHeight - 40) {
        doc.addPage();
        y = cfg.margin;
    }

    doc.setFillColor(64, 64, 64);
    doc.rect(cfg.margin, y - 5, cfg.pageWidth - (cfg.margin * 2), 10, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(cfg.headingSize);
    doc.setFont('helvetica', 'bold');
    doc.text(text, cfg.margin + 5, y + 2);
    doc.setTextColor(0, 0, 0);

    return y + 15;
}

function addSubheading(doc, y, text) {
    const cfg = PDF_CONFIG;

    if (y > cfg.pageHeight - 30) {
        doc.addPage();
        y = cfg.margin;
    }

    doc.setFontSize(cfg.subheadingSize);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(64, 64, 64);
    doc.text(text, cfg.margin, y);
    doc.setTextColor(0, 0, 0);

    return y + cfg.lineHeight;
}

function addText(doc, y, text, indent = 0) {
    const cfg = PDF_CONFIG;
    const maxWidth = cfg.pageWidth - (cfg.margin * 2) - indent;

    doc.setFontSize(cfg.bodySize);
    doc.setFont('helvetica', 'normal');

    const lines = doc.splitTextToSize(text, maxWidth);

    for (const line of lines) {
        if (y > cfg.pageHeight - cfg.margin) {
            doc.addPage();
            y = cfg.margin;
        }
        doc.text(line, cfg.margin + indent, y);
        y += cfg.lineHeight;
    }

    return y;
}

function addSmallText(doc, y, text, indent = 0) {
    const cfg = PDF_CONFIG;
    doc.setFontSize(cfg.smallSize);
    doc.setTextColor(100, 100, 100);

    if (y > cfg.pageHeight - cfg.margin) {
        doc.addPage();
        y = cfg.margin;
    }

    doc.text(text, cfg.margin + indent, y);
    doc.setTextColor(0, 0, 0);
    return y + cfg.lineHeight;
}

function addDivider(doc, y) {
    const cfg = PDF_CONFIG;
    doc.setDrawColor(200, 200, 200);
    doc.line(cfg.margin, y, cfg.pageWidth - cfg.margin, y);
    return y + 5;
}

function addFooter(doc) {
    const pageCount = doc.internal.getNumberOfPages();
    const cfg = PDF_CONFIG;

    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(cfg.smallSize);
        doc.setTextColor(128, 128, 128);
        doc.text(
            `StoryKeys Content Audit • Page ${i} of ${pageCount} • Generated ${new Date().toLocaleDateString('en-GB')}`,
            cfg.pageWidth / 2,
            cfg.pageHeight - 10,
            { align: 'center' }
        );
    }
}

// ============================================
// Key Stage PDF Generation
// ============================================

function generatePDF(keyStage) {
    const data = dataStore.keyStages[keyStage];
    const doc = createPDF();
    const cfg = PDF_CONFIG;

    const ageRanges = {
        KS1: 'Ages 5-7',
        KS2: 'Ages 7-11',
        KS3: 'Ages 11-14',
        KS4: 'Ages 14-16'
    };

    let y = addHeader(doc, `${keyStage} Content Review`, `${ageRanges[keyStage]} • StoryKeys Educational Content`);

    // Statistics summary
    y = addSectionHeader(doc, y, 'Content Statistics');
    y = addText(doc, y, `Passages: ${data.passages.length} | Patterns: ${data.patterns.length} | Wordsets: ${data.wordsets.length}`);
    y += 5;

    // Passages
    y = addSectionHeader(doc, y, 'PASSAGES');
    const passagesByTheme = groupBy(data.passages, 'theme');

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
            y = addSmallText(doc, y, `ID: ${passage.id} | Est. chars: ${passage.meta?.est_chars || 'N/A'}`, 10);
            y += 3;
        }
        y += 5;
    }

    // Patterns
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

    // Wordsets
    doc.addPage();
    y = cfg.margin;
    y = addSectionHeader(doc, y, 'WORDSETS');
    const wordsetsByTheme = groupBy(data.wordsets, 'theme');

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

// ============================================
// Badges PDF Generation
// ============================================

function generateBadgesPDF() {
    const badges = dataStore.badges;
    const doc = createPDF();
    const cfg = PDF_CONFIG;

    let y = addHeader(doc, 'Badges Content Review', 'StoryKeys Achievement System');

    // Statistics
    y = addSectionHeader(doc, y, 'Statistics');
    const tracks = {};
    badges.forEach(b => { if (b.track) tracks[b.track] = (tracks[b.track] || 0) + 1; });
    y = addText(doc, y, `Total Badges: ${badges.length}`);
    y = addText(doc, y, `Tracks: ${Object.keys(tracks).join(', ')}`);
    y += 5;

    // Group by track
    const badgesByTrack = groupBy(badges, 'track');

    for (const [track, trackBadges] of Object.entries(badgesByTrack)) {
        y = addSectionHeader(doc, y, `Track: ${track?.toUpperCase() || 'UNASSIGNED'}`);

        // Sort by tier
        trackBadges.sort((a, b) => (a.tier || 0) - (b.tier || 0));

        for (const badge of trackBadges) {
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
            y = addSmallText(doc, y, `ID: ${badge.id}${badge.requires ? ' | Requires: ' + badge.requires : ''}`, 10);
            y += 3;
        }
    }

    addFooter(doc);
    doc.save('StoryKeys_Badges_Review.pdf');
}

// ============================================
// Phonics PDF Generation
// ============================================

function generatePhonicsPDF() {
    const phonics = dataStore.phonics;
    const doc = createPDF();
    const cfg = PDF_CONFIG;

    let y = addHeader(doc, 'Phonics Lessons Review', 'StoryKeys Educational Content');

    // Statistics
    y = addSectionHeader(doc, y, 'Statistics');
    let totalChars = 0;
    phonics.forEach(p => { if (p.meta?.est_chars) totalChars += p.meta.est_chars; });
    y = addText(doc, y, `Total Lessons: ${phonics.length}`);
    y = addText(doc, y, `Total Characters: ${totalChars.toLocaleString()}`);
    y = addText(doc, y, `Average Length: ${Math.round(totalChars / phonics.length)} characters`);
    y += 5;

    // All phonics lessons
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
        y = addSmallText(doc, y, `ID: ${lesson.id} | Tags: ${phonicsTags} | Est. chars: ${lesson.meta?.est_chars || 'N/A'}`, 10);
        y = addDivider(doc, y);
        y += 3;
    }

    addFooter(doc);
    doc.save('StoryKeys_Phonics_Review.pdf');
}

// ============================================
// Spelling PDF Generation
// ============================================

function generateSpellingPDF() {
    const spelling = dataStore.spelling;
    const doc = createPDF();
    const cfg = PDF_CONFIG;

    let y = addHeader(doc, 'Spelling Sets Review', 'StoryKeys Educational Content');

    // Statistics
    y = addSectionHeader(doc, y, 'Statistics');
    let totalWords = 0;
    spelling.forEach(s => { if (s.words) totalWords += s.words.length; });
    y = addText(doc, y, `Total Spelling Sets: ${spelling.length}`);
    y = addText(doc, y, `Total Words: ${totalWords.toLocaleString()}`);
    y += 5;

    // Group by stage
    const spellingByStage = groupBy(spelling, 'stage');

    for (const stage of ['KS1', 'KS2', 'KS3', 'KS4']) {
        const stageSets = spellingByStage[stage] || [];
        if (stageSets.length === 0) continue;

        y = addSectionHeader(doc, y, `${stage} Spelling Sets`);

        // Group by theme within stage
        const byTheme = groupBy(stageSets, 'theme');

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

// ============================================
// Combined PDF Generation
// ============================================

function generateAllKeyStagesPDF() {
    const doc = createPDF();
    const cfg = PDF_CONFIG;

    let y = addHeader(doc, 'All Key Stages Content Review', 'StoryKeys Complete Passages, Patterns & Wordsets');

    // Overview
    y = addSectionHeader(doc, y, 'Overview');
    let totalP = 0, totalPat = 0, totalW = 0;
    for (const ks of ['KS1', 'KS2', 'KS3', 'KS4']) {
        const d = dataStore.keyStages[ks];
        totalP += d.passages.length;
        totalPat += d.patterns.length;
        totalW += d.wordsets.length;
    }
    y = addText(doc, y, `Total Passages: ${totalP} | Total Patterns: ${totalPat} | Total Wordsets: ${totalW}`);
    y += 5;

    for (const ks of ['KS1', 'KS2', 'KS3', 'KS4']) {
        const data = dataStore.keyStages[ks];
        const ageRanges = { KS1: '5-7', KS2: '7-11', KS3: '11-14', KS4: '14-16' };

        doc.addPage();
        y = cfg.margin;

        // Key Stage header
        doc.setFillColor(45, 45, 45);
        doc.rect(0, 0, cfg.pageWidth, 25, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text(`${ks} Content (Ages ${ageRanges[ks]})`, cfg.margin, 16);
        doc.setTextColor(0, 0, 0);
        y = 35;

        // Passages
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

        // Patterns
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

        // Wordsets
        doc.addPage();
        y = cfg.margin;
        y = addSectionHeader(doc, y, 'Wordsets');
        for (const wordset of data.wordsets) {
            if (y > cfg.pageHeight - 30) {
                doc.addPage();
                y = cfg.margin;
            }
            doc.setFont('helvetica', 'bold');
            doc.text(`• ${wordset.name}`, cfg.margin + 5, y);
            y += cfg.lineHeight;
            y = addText(doc, y, `Words: ${wordset.words?.join(', ')}`, 10);
            y += 3;
        }
    }

    addFooter(doc);
    doc.save('StoryKeys_All_KeyStages_Review.pdf');
}

function generateCompletePDF() {
    const doc = createPDF();
    const cfg = PDF_CONFIG;

    let y = addHeader(doc, 'Complete Content Review', 'StoryKeys - All Educational Content for Suitability Review');

    // Table of Contents
    y = addSectionHeader(doc, y, 'Contents');
    y = addText(doc, y, '1. Overview Statistics');
    y = addText(doc, y, '2. Key Stage Content (KS1-KS4)');
    y = addText(doc, y, '3. Badges & Achievements');
    y = addText(doc, y, '4. Phonics Lessons');
    y = addText(doc, y, '5. Spelling Sets');

    // Overview Statistics
    doc.addPage();
    y = cfg.margin;
    y = addSectionHeader(doc, y, '1. OVERVIEW STATISTICS');

    let totalP = 0, totalPat = 0, totalW = 0;
    for (const ks of ['KS1', 'KS2', 'KS3', 'KS4']) {
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

    // Key Stages
    for (const ks of ['KS1', 'KS2', 'KS3', 'KS4']) {
        const data = dataStore.keyStages[ks];
        const ageRanges = { KS1: '5-7', KS2: '7-11', KS3: '11-14', KS4: '14-16' };

        doc.addPage();
        y = cfg.margin;

        doc.setFillColor(45, 45, 45);
        doc.rect(0, 0, cfg.pageWidth, 20, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text(`2. KEY STAGE: ${ks} (Ages ${ageRanges[ks]})`, cfg.margin, 14);
        doc.setTextColor(0, 0, 0);
        y = 30;

        // Passages
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

    // Badges
    doc.addPage();
    y = cfg.margin;
    y = addSectionHeader(doc, y, '3. BADGES & ACHIEVEMENTS');

    const badgesByTrack = groupBy(dataStore.badges, 'track');
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

    // Phonics
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

    // Spelling
    doc.addPage();
    y = cfg.margin;
    y = addSectionHeader(doc, y, '5. SPELLING SETS');

    const spellingByStage = groupBy(dataStore.spelling, 'stage');
    for (const stage of ['KS1', 'KS2', 'KS3', 'KS4']) {
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
            doc.text(`• ${set.name}`, cfg.margin + 5, y);
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

// Utility function
function groupBy(array, key) {
    return array.reduce((result, item) => {
        const groupKey = item[key] || 'Other';
        if (!result[groupKey]) result[groupKey] = [];
        result[groupKey].push(item);
        return result;
    }, {});
}
