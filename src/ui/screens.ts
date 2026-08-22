import { loadDraft } from '../draft';
import { FINGER_ZONES } from '../session/keyboard';
import { STAGES } from '../types';
import type { AppData, AppState, ScreenName, SessionRecord, Stage } from '../types';
import { escapeHtml, getLessonTitle } from '../utils';
import { buttonClass, cx, ui } from './classes';
import { getPetEmoji } from './feedback';

const THEME_ICONS: Record<string, string> = {
  Animals: '🐾',
  'Silly Stories': '🤪',
  Nature: '🌿',
  Core: '📚',
  Phonics: '🔤',
  Statutory: '📜',
  'Science snips': '🔬',
  Myths: '🦄',
  Academic: '🎓',
  History: '🏛️',
  Geography: '🗺️',
};

export { THEME_ICONS };

const STAGE_NAMES: Record<Stage, string> = {
  KS1: 'Ages 5–7',
  KS2: 'Ages 7–11',
  KS3: 'Ages 11–14',
  KS4: 'Ages 14–16',
};

const CHEVRON = `<svg viewBox="0 0 24 24" class="w-5 h-5 fill-current shrink-0 transition-transform duration-200 group-open:rotate-180" aria-hidden="true"><path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z"/></svg>`;

function formatRecentTitle(lesson: { title?: string; id?: string }): string {
  if (lesson.title) return lesson.title;
  const fromId = (lesson.id || '').split('_').slice(1).join(' ').replace(/_/g, ' ');
  return fromId || lesson.id || 'Lesson';
}

function getRecentLessonsHtml(state: AppState): string {
  if (!state.sessions.length) return '';

  const seen = new Set<string>();
  const recentLessons: Array<{
    id: string;
    type: SessionRecord['contentType'];
    stage?: string;
    title: string;
    accuracy: number;
    wpm: number;
  }> = [];

  for (let i = state.sessions.length - 1; i >= 0 && recentLessons.length < 4; i--) {
    const session = state.sessions[i];
    if (!session || seen.has(session.contentId)) continue;
    seen.add(session.contentId);
    recentLessons.push({
      id: session.contentId,
      type: session.contentType,
      stage: session.stage,
      title: session.title,
      accuracy: session.accuracy,
      wpm: session.netWPM,
    });
  }

  if (!recentLessons.length) return '';

  const items = recentLessons.map((lesson) => `
        <button type="button" class="recent-lesson-btn tile flex justify-between items-center gap-3 px-4 py-3 min-h-12 bg-sk-card border border-sk-border rounded-xl cursor-pointer text-left w-full" data-recent-id="${escapeHtml(lesson.id)}" data-recent-type="${escapeHtml(lesson.type)}" data-recent-stage="${escapeHtml(lesson.stage || '')}">
            <span class="font-semibold min-w-0 truncate">${escapeHtml(formatRecentTitle(lesson))}</span>
            <span class="text-sm text-sk-muted shrink-0 tabular-nums">${lesson.accuracy}% · ${lesson.wpm || '–'} wpm</span>
        </button>`).join('');

  return `
        <section class="${ui.card}" aria-labelledby="recent-heading">
            <h2 id="recent-heading" class="${ui.sectionTitle}">Pick up where you left off</h2>
            <div class="recent-lessons-list flex flex-col gap-2 mt-4">${items}</div>
        </section>`;
}

function renderHome(state: AppState): string {
  const draft = loadDraft();
  const stage = state.settings.defaultStage;
  const minutes = Math.round(state.progress.minutesTotal);
  const streak = state.progress.consecutiveDays;

  const draftHtml = draft ? `
                <section id="resume-draft-card" class="${cx(ui.card, 'resume-card')}" aria-labelledby="resume-heading">
                    <p class="${ui.eyebrow}">Unfinished lesson</p>
                    <h2 id="resume-heading" class="${cx(ui.sectionTitle, 'mt-1')}">${escapeHtml(getLessonTitle(draft.lessonData))}</h2>
                    <p class="${cx(ui.lead, 'mt-2')}">${draft.typedText.length > 0
                      ? `You typed ${draft.typedText.length} characters last time.`
                      : 'You opened this lesson but had not started typing.'}</p>
                    <div class="${cx(ui.buttonRow, 'mt-5')}">
                        <button id="resume-draft-btn" type="button" class="${buttonClass('primary')}">Carry on</button>
                        <button id="discard-draft-btn" type="button" class="${buttonClass('quiet')}">Start something else</button>
                    </div>
                </section>` : '';

  // Every stage stays one click away, but the learner's own stage leads so the
  // first screen is three clear choices rather than nine.
  const otherStages = STAGES.map((s) => `
                            <div class="flex items-center gap-3 py-1.5">
                                <span class="w-24 shrink-0 font-bold">${s}<span class="block text-xs font-normal text-sk-muted">${STAGE_NAMES[s]}</span></span>
                                <button type="button" class="${cx(buttonClass('secondary', 'sm'), 'flex-1')}" data-stage="${s}">Story</button>
                                <button type="button" class="${cx(buttonClass('secondary', 'sm'), 'flex-1')}" data-spelling-stage="${s}">Spelling</button>
                            </div>`).join('');

  return `
            <div id="home-screen" class="screen active flex flex-col gap-5 sm:gap-6">
                <header class="text-center pt-1 pb-2">
                    <h1 class="text-[1.9rem] sm:text-[2.4rem]">Welcome to StoryKeys</h1>
                    <p class="${cx(ui.lead, 'mx-auto mt-1 text-[1.05rem]')}">A calm, friendly place to practise typing.</p>
                </header>

                ${draftHtml}

                <section id="new-story-card" class="${ui.card}" aria-labelledby="start-heading">
                    <p class="${ui.eyebrow}">Your key stage · ${stage}</p>
                    <h2 id="start-heading" class="${cx(ui.sectionTitle, 'mt-1')}">Ready to type?</h2>
                    <p class="${cx(ui.lead, 'mt-2')}">Pick a short story, practise your spellings, or work on letter sounds.</p>

                    <div class="flex flex-col gap-3 mt-6">
                        <button type="button" class="${buttonClass('primary', 'lg', 'block')}" data-stage="${stage}">
                            <span aria-hidden="true">📖</span> Read and type a story
                        </button>
                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <button type="button" class="${buttonClass('spelling', 'block')}" data-spelling-stage="${stage}">
                                <span aria-hidden="true">✏️</span> Spelling practice
                            </button>
                            <button id="phonics-mode-btn" type="button" class="${buttonClass('phonics', 'block')}">
                                <span aria-hidden="true">🔤</span> Letter sounds
                            </button>
                        </div>
                    </div>

                    <details class="group mt-5 border-t border-sk-border pt-4">
                        <summary class="${cx('flex items-center justify-between gap-2 font-semibold text-sk-muted hover:text-sk-text min-h-11 rounded-xl px-1', 'marker:content-none')}">
                            <span>Try a different key stage</span>
                            ${CHEVRON}
                        </summary>
                        <div class="mt-3 flex flex-col divide-y divide-sk-border">${otherStages}</div>
                    </details>
                </section>

                ${getRecentLessonsHtml(state)}

                <section class="${ui.card}" aria-labelledby="explore-heading">
                    <h2 id="explore-heading" class="${ui.sectionTitle}">Explore</h2>
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                        <button id="browse-lessons-btn" type="button" class="${cx(buttonClass('secondary', 'block'), 'justify-start text-left h-auto py-4')}">
                            <span class="text-2xl shrink-0" aria-hidden="true">📚</span>
                            <span class="min-w-0">
                                <span class="block">All lessons</span>
                                <span class="block text-sm font-normal text-sk-muted">Stories, word sets and drills</span>
                            </span>
                        </button>
                        <button id="view-badges-btn" type="button" class="${cx(buttonClass('secondary', 'block'), 'justify-start text-left h-auto py-4')}">
                            <span class="text-2xl shrink-0" aria-hidden="true">🏅</span>
                            <span class="min-w-0">
                                <span class="block">Your badges</span>
                                <span class="block text-sm font-normal text-sk-muted">See what you have earned</span>
                            </span>
                        </button>
                    </div>
                </section>

                <section class="${cx(ui.cardTight, streak > 0 ? 'streak-card' : '')} flex items-center gap-4 sm:gap-5" aria-labelledby="progress-heading">
                    <span class="text-4xl sm:text-5xl shrink-0" aria-hidden="true">${streak > 0 ? '🔥' : getPetEmoji(state.progress.minutesTotal)}</span>
                    <div class="min-w-0">
                        <h2 id="progress-heading" class="${cx('text-[1.15rem] font-bold m-0', streak > 0 ? 'streak-heading' : '')}">${
                          streak > 0
                            ? `${streak} day${streak === 1 ? '' : 's'} in a row`
                            : 'Your progress'
                        }</h2>
                        <p class="m-0 text-[0.95rem] text-sk-muted">${minutes > 0
                          ? `You have practised for ${minutes} minute${minutes === 1 ? '' : 's'} altogether.`
                          : 'Finish your first lesson to start building a streak.'}</p>
                    </div>
                </section>
            </div>`;
}

function renderTyping(state: AppState, data: AppData): string {
  const targetText = state.runtime.targetText ?? '';
  const initialHtml = targetText.split('').map((char, idx) =>
    `<span class="char" data-idx="${idx}">${escapeHtml(char)}</span>`,
  ).join('');

  const keyboardHint = Boolean(state.runtime.flags?.keyboardHint);
  const showFingerGuide = state.settings.fingerGuide;
  const keyboardLayout = [
    ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
    ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', ';'],
    ['z', 'x', 'c', 'v', 'b', 'n', 'm', ',', '.'],
  ];

  const keyboardHtml = keyboardHint
    ? `<div id="keyboard-hint" class="${showFingerGuide ? 'finger-guide' : ''} p-2 bg-sk-subtle border border-sk-border rounded-xl select-none overflow-x-auto">${keyboardLayout.map((row) => `<div class="keyboard-row flex justify-center">${row.map((key) => `<div class="key ${showFingerGuide ? `finger-${FINGER_ZONES[key] ?? ''}` : ''}" data-key="${key}">${key}</div>`).join('')}</div>`).join('')}<div class="keyboard-row flex justify-center"><div class="key space ${showFingerGuide ? 'finger-thumb' : ''}" data-key=" ">Space</div></div></div>`
    : '';

  // Only rendered when the learner has the finger guide switched on.
  const fingerHtml = showFingerGuide
    ? `<div id="finger-hint" class="flex flex-col items-center gap-1">
                            <svg viewBox="0 0 160 38" class="w-[170px] sm:w-[200px] h-11" role="img" aria-label="Which finger to use next">
                                <circle cx="11" cy="27" r="7" class="finger" data-finger="lp"/>
                                <circle cx="24" cy="16" r="7" class="finger" data-finger="lr"/>
                                <circle cx="37" cy="11" r="7" class="finger" data-finger="lm"/>
                                <circle cx="50" cy="16" r="7" class="finger" data-finger="li"/>
                                <circle cx="64" cy="27" r="8" class="finger thumb" data-finger="thumb"/>
                                <circle cx="96" cy="27" r="8" class="finger thumb" data-finger="thumb"/>
                                <circle cx="110" cy="16" r="7" class="finger" data-finger="ri"/>
                                <circle cx="123" cy="11" r="7" class="finger" data-finger="rm"/>
                                <circle cx="136" cy="16" r="7" class="finger" data-finger="rr"/>
                                <circle cx="149" cy="27" r="7" class="finger" data-finger="rp"/>
                            </svg>
                            <span class="${ui.eyebrow}">Finger to use</span>
                        </div>`
    : '';

  const helperHtml = fingerHtml || keyboardHtml
    ? `<div class="flex flex-col items-center gap-4 mt-6">${fingerHtml}${keyboardHtml}</div>`
    : '';

  return `
            <div id="typing-screen" class="screen active flex flex-col gap-4">
                <div class="sticky top-0 z-50 progress-track w-full h-2.5" role="progressbar" aria-label="Lesson progress">
                    <div id="typing-progress-bar" class="progress-bar h-full w-0"></div>
                </div>

                <div class="${ui.card}">
                    <div class="flex items-center justify-between gap-3 mb-5">
                        <button id="exit-lesson-btn" type="button" class="${cx(buttonClass('quiet', 'sm'), 'shrink-0')}" title="Save and leave this lesson">
                            <span aria-hidden="true">←</span> Exit
                        </button>
                        <h1 class="text-[1.15rem] sm:text-[1.4rem] font-bold m-0 text-center min-w-0 truncate">${escapeHtml(getLessonTitle(state.runtime.lesson?.data))}</h1>
                        <div class="shrink-0 min-w-[4.5rem] flex justify-end">
                            ${state.runtime.flags?.showTimerChip
                              ? `<div id="timer-chip" class="timer-chip text-[1.05rem] font-bold px-3 py-1.5 rounded-full" aria-live="off">--:--</div>`
                              : ''}
                        </div>
                    </div>

                    <div class="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 mb-5 pb-4 border-b border-sk-border">
                        <button id="read-aloud-btn" type="button" class="${cx(buttonClass('secondary', 'sm'), 'read-aloud-btn')}" title="Listen to the words before you type">
                            <span aria-hidden="true">🔊</span> Read aloud
                        </button>
                        <div class="${ui.buttonGroup}">
                            <label class="${ui.toggle}"><input type="checkbox" id="lockstep-toggle" ${state.runtime.flags?.lockstep ? 'checked' : ''}><span class="slider"></span><span>${escapeHtml(data.COPY.lockstepOn)}</span></label>
                            <label class="${ui.toggle}"><input type="checkbox" id="focusline-toggle" ${state.runtime.flags?.focusLine ? 'checked' : ''}><span class="slider"></span><span>${escapeHtml(data.COPY.focusLineOn)}</span></label>
                            <div id="caps-lock-indicator" class="caps-lock-indicator" title="Caps Lock is on">
                                <span class="caps-lock-led"></span>
                                <span>Caps</span>
                            </div>
                        </div>
                    </div>

                    <p class="panel-label" id="read-this-label"><span aria-hidden="true">👀</span> Read this</p>
                    <div id="typing-target" class="typing-target ${state.runtime.flags?.focusLine ? 'focus-line-active' : ''}" aria-describedby="read-this-label">${initialHtml}</div>

                    <p class="panel-label mt-5"><span aria-hidden="true">⌨️</span> <label for="typing-input">Type here</label></p>
                    <textarea id="typing-input" class="typing-input" rows="3" spellcheck="false" autocomplete="off" autocorrect="off" autocapitalize="off"></textarea>

                    ${helperHtml}
                </div>

                <div id="pause-overlay" class="pause-overlay hidden" role="dialog" aria-modal="true" aria-labelledby="pause-title">
                    <div class="${cx(ui.card, 'text-center max-w-sm mx-4 p-8')}">
                        <div class="text-5xl mb-3" aria-hidden="true">⏸️</div>
                        <h2 id="pause-title" class="text-2xl mb-3">Paused</h2>
                        <p class="m-0 text-sk-muted">Press <kbd>Space</kbd> or <kbd>Esc</kbd> when you are ready to carry on.</p>
                    </div>
                </div>
            </div>`;
}

function metric(label: string, value: string | number, note?: string): string {
  return `<div class="text-center">
                            <p class="${ui.eyebrow}">${escapeHtml(label)}</p>
                            <p class="metric-value text-[2.1rem] sm:text-[2.5rem] m-0 mt-1">${value}</p>
                            ${note ? `<p class="m-0 text-sm text-sk-muted">${escapeHtml(note)}</p>` : ''}
                        </div>`;
}

function renderSummary(state: AppState, data: AppData): string {
  const results = state.runtime.summaryResults;
  if (!results) return '<h1>Error</h1>';
  const { accuracy, durationSec, errors, netWPM, grossWPM, hardestKeys, trickyWords, newBadges, isDrill, personalBest } = results;
  const wpmLabel = data.COPY.metricWPM || data.COPY.metricNetWPM || 'Words per minute';
  const safeNet = typeof netWPM === 'number' ? netWPM : '—';
  const safeGross = typeof grossWPM === 'number' ? grossWPM : '—';
  const drillBtnHtml = !isDrill && (hardestKeys.length > 0 || trickyWords.length > 0)
    ? `<button id="start-drill-btn" type="button" class="${buttonClass('secondary')}">${escapeHtml(data.COPY.summaryDrill)}</button>`
    : '';
  const prettyKeyName = (k: string) => (k === ' ' ? 'Space' : k);
  const isPerfect = accuracy === 100;
  const isNewBest = Boolean(personalBest && !isDrill && (netWPM > personalBest.netWPM || accuracy > personalBest.accuracy));

  let comparisonHtml = '';
  if (personalBest && !isDrill) {
    const wpmDiff = netWPM - personalBest.netWPM;
    const accDiff = accuracy - personalBest.accuracy;
    const row = (label: string, best: string, now: string, diff: number) => {
      const icon = diff > 0 ? '🎉' : diff === 0 ? '➡️' : '↓';
      return `<div class="flex justify-center items-center gap-3 py-1 text-[0.95rem]">
                            <span class="text-sk-muted min-w-[8.5rem] text-right">${escapeHtml(label)}: ${escapeHtml(best)}</span>
                            <span aria-hidden="true">${icon}</span>
                            <span class="min-w-[8.5rem] text-left font-bold tabular-nums">${escapeHtml(now)}${diff !== 0 ? ` (${diff > 0 ? '+' : ''}${diff})` : ''}</span>
                        </div>`;
    };
    comparisonHtml = `
                    <div class="personal-best-comparison ${isNewBest ? 'new-best' : 'bg-sk-subtle border border-sk-border'} p-4 rounded-xl my-6 mx-auto max-w-md text-center">
                        <h3 class="m-0 mb-2 text-base">${isNewBest ? '🏆 A new personal best!' : 'Compared with your best'}</h3>
                        ${row('Words per minute', String(personalBest.netWPM), String(safeNet), wpmDiff)}
                        ${row('Accuracy', `${personalBest.accuracy}%`, `${accuracy}%`, accDiff)}
                    </div>`;
  }

  const wpmSamples = state.runtime.wpmSamples || [];
  const sparklineHtml = wpmSamples.length > 2 ? (() => {
    const maxWpm = Math.max(...wpmSamples, 1);
    const points = wpmSamples.map((wpm, i) => {
      const x = (i / (wpmSamples.length - 1)) * 100;
      const y = 30 - (wpm / maxWpm) * 28;
      return `${x},${y}`;
    }).join(' ');
    return `
                    <div class="my-6 p-4 bg-sk-subtle border border-sk-border rounded-xl">
                        <p class="${ui.eyebrow}">Your speed through the lesson</p>
                        <svg class="w-full h-10 mt-2" viewBox="0 0 100 32" preserveAspectRatio="none" aria-hidden="true">
                            <polyline fill="none" stroke="var(--sk-accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" points="${points}"/>
                        </svg>
                        <div class="flex justify-between text-xs text-sk-muted"><span>Start</span><span>End</span></div>
                    </div>`;
  })() : '';

  const encouragement = data.COPY.encourageGentle[Math.floor(Math.random() * data.COPY.encourageGentle.length)] ?? '';

  const listBlock = (heading: string, items: string[], pretty: (s: string) => string) => `
                        <div>
                            <p class="${ui.eyebrow}">${escapeHtml(heading)}</p>
                            <ul class="list-none p-0 m-0 mt-2 flex flex-wrap gap-2">${items.map((k) => `<li class="bg-sk-subtle border border-sk-border px-3 py-1 rounded-full font-semibold">${escapeHtml(pretty(k))}</li>`).join('')}</ul>
                        </div>`;

  return `
            <div id="summary-screen" class="screen active flex flex-col gap-6 ${isNewBest || isPerfect ? 'show-confetti' : ''}">
                <div class="${cx(ui.card, 'relative')}">
                    <div class="text-center">
                        <div class="text-5xl mb-2" aria-hidden="true">${isPerfect ? '🌟' : '👏'}</div>
                        <h1>${isDrill ? 'Drill complete!' : escapeHtml(data.COPY.summaryNiceWork)}</h1>
                        <p class="${cx(ui.lead, 'mx-auto')}">${escapeHtml(encouragement)}</p>
                    </div>

                    ${isPerfect ? '<div class="perfect-banner mt-5">Every single letter correct!</div>' : ''}

                    ${newBadges.length > 0 ? `<div class="flex flex-col gap-3 mt-6">${newBadges.map((id) => {
                      const badge = data.BADGES.find((b) => b.id === id);
                      if (!badge) return '';
                      return `<div class="badge-earned relative flex items-center gap-4 p-4 rounded-xl text-left">
                            <span class="text-3xl shrink-0" aria-hidden="true">🏅</span>
                            <span class="min-w-0">
                                <span class="block font-bold">New badge: ${escapeHtml(badge.label)}</span>
                                <span class="block text-sm">${escapeHtml(badge.desc)}</span>
                            </span>
                        </div>`;
                    }).join('')}</div>` : ''}

                    <div class="grid grid-cols-2 sm:grid-cols-4 gap-5 my-8">
                        ${metric(data.COPY.metricAccuracy, `${accuracy}%`)}
                        ${metric(wpmLabel, String(safeNet), `${safeGross} gross`)}
                        ${metric(data.COPY.metricTime, `${durationSec}s`)}
                        ${metric(data.COPY.metricErrors, String(errors))}
                    </div>

                    ${sparklineHtml}
                    ${comparisonHtml}

                    ${hardestKeys.length > 0 || trickyWords.length > 0 ? `
                    <div class="flex gap-8 flex-wrap justify-center mt-2">
                        ${hardestKeys.length > 0 ? listBlock(data.COPY.summaryHardestKeys, hardestKeys, prettyKeyName) : ''}
                        ${trickyWords.length > 0 ? listBlock(data.COPY.summaryTrickyWords, trickyWords, (w) => w) : ''}
                    </div>` : ''}

                    <div class="${cx(ui.buttonRowCenter, 'mt-8')}">
                        ${!isDrill ? `<button id="replay-btn" type="button" class="${buttonClass('primary')}">${escapeHtml(data.COPY.summaryReplay)}</button>` : ''}
                        ${drillBtnHtml}
                        <button id="home-btn" type="button" class="${buttonClass('secondary')}">${escapeHtml(data.COPY.summaryHome)}</button>
                    </div>
                    <p class="text-center text-sm text-sk-muted mt-5 m-0">Press <kbd>Enter</kbd> to try again, or <kbd>Esc</kbd> to go home.</p>
                </div>
            </div>`;
}

export function getScreenHtml(screenName: ScreenName, state: AppState, data: AppData): string {
  switch (screenName) {
    case 'home':
      return renderHome(state);
    case 'typing':
      return renderTyping(state, data);
    case 'summary':
      return renderSummary(state, data);
    default:
      return '<h1>Error</h1>';
  }
}
