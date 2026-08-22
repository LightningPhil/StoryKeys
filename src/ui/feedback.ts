import type { AppData, AppState } from '../types';
import { escapeHtml } from '../utils';

const PET_LEVELS = ['💠', '🐣', '🐤', '🐔', '🦖', '🐉'];

export function getPetEmoji(minutesTotal: number): string {
  const petIndex = Math.min(PET_LEVELS.length - 1, Math.floor(minutesTotal / 30));
  return PET_LEVELS[petIndex] ?? '💠';
}

export function applySettings(settings: AppState['settings'], progress: AppState['progress']): void {
  const htmlEl = document.documentElement;
  htmlEl.classList.remove('theme-light', 'theme-cream', 'theme-dark');
  htmlEl.classList.add(`theme-${settings.theme}`);

  const fontMap: Record<string, string> = {
    default: 'var(--font-family-default)',
    dyslexia: 'var(--font-family-dyslexia)',
    opendyslexic: 'var(--font-family-opendyslexic)',
  };
  htmlEl.style.setProperty('--font-family', fontMap[settings.font] || fontMap.default);
  htmlEl.style.setProperty('--line-height', String(settings.lineHeight));
  htmlEl.style.setProperty('--letter-spacing', `${settings.letterSpacing / 100}em`);
  htmlEl.classList.toggle('reduce-motion', settings.reduceMotion === true);

  const pet = document.getElementById('progress-pet');
  if (pet) pet.textContent = getPetEmoji(progress.minutesTotal);
}

export function toast(msg: string): void {
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  t.setAttribute('role', 'status');
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2500);
}

export function triggerConfetti(): void {
  const container = document.querySelector('.badge-earned') || document.querySelector('#summary-screen .card');
  if (!container) return;
  for (let i = 0; i < 30; i++) {
    const confetti = document.createElement('div');
    confetti.className = 'confetti';
    confetti.style.left = `${Math.random() * 100}%`;
    confetti.style.animationDelay = `${Math.random() * 2}s`;
    confetti.style.backgroundColor = ['#3b82f6', '#16a34a', '#f59e0b', '#ef4444'][Math.floor(Math.random() * 4)] ?? '#3b82f6';
    container.appendChild(confetti);
  }
}

export function printCertificate(state: AppState, data: AppData): void {
  const badges = state.progress.badges.map((entry) => {
    const badge = data.BADGES.find((b) => b.id === entry.id) || { label: entry.id };
    return badge.label ?? entry.id;
  });
  const totalMinutes = Math.round(state.progress.minutesTotal);
  const dateString = new Date().toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' });

  const certificateHtml = `<!DOCTYPE html>
<html>
<head>
    <title>StoryKeys Certificate</title>
    <style>
        @page { size: landscape; margin: 0.5in; }
        body { font-family: Georgia, 'Times New Roman', serif; text-align: center; padding: 40px; background: linear-gradient(135deg, #fef3c7, #fff); min-height: 100vh; box-sizing: border-box; }
        .certificate { border: 8px double #b45309; padding: 40px; background: #fffbeb; max-width: 900px; margin: 0 auto; }
        h1 { color: #92400e; font-size: 2.5rem; margin: 0; letter-spacing: 0.1em; }
        .subtitle { font-size: 1.2rem; color: #78350f; margin: 10px 0 30px; }
        .recipient { font-size: 1.8rem; font-style: italic; color: #1f2937; margin: 30px 0; border-bottom: 2px solid #d97706; padding-bottom: 10px; display: inline-block; min-width: 300px; }
        .achievement-text { font-size: 1.1rem; color: #374151; margin: 20px 0; }
        .badges { margin: 30px 0; display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; }
        .badge-chip { background: #fef3c7; border: 1px solid #f59e0b; padding: 5px 15px; border-radius: 20px; font-size: 0.9rem; }
        .date { margin-top: 40px; font-size: 0.95rem; color: #9ca3af; }
        .logo { font-size: 2rem; margin-bottom: 10px; }
        @media print { body { background: white; } }
    </style>
</head>
<body>
    <div class="certificate">
        <div class="logo">📚✨</div>
        <h1>Certificate of Achievement</h1>
        <p class="subtitle">StoryKeys Typing Practice</p>
        <p class="achievement-text">This certificate is awarded to</p>
        <div class="recipient">________________</div>
        <p class="achievement-text">for demonstrating dedication and skill in typing practice,<br>earning ${badges.length} badge${badges.length !== 1 ? 's' : ''} and practicing for ${totalMinutes} minutes.</p>
        <div class="badges">
            ${badges.slice(0, 12).map((b) => `<span class="badge-chip">${escapeHtml(b)}</span>`).join('')}
            ${badges.length > 12 ? `<span class="badge-chip">+${badges.length - 12} more</span>` : ''}
        </div>
        <p class="date">Awarded on ${dateString}</p>
    </div>
    <script>window.onload = () => window.print();</script>
</body>
</html>`;

  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(certificateHtml);
    printWindow.document.close();
  } else {
    toast('Pop-up blocked. Please allow pop-ups to print the certificate.');
  }
}

export function renderMarkdownBlock(md: string): string {
  const escaped = escapeHtml(md);
  const formatted = escaped
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`(.+?)`/g, '<code>$1</code>');
  return formatted
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${paragraph.replace(/\n/g, '<br>')}</p>`)
    .join('');
}
