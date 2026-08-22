import type { AppData, AppState, ModalName } from '../types';
import { escapeHtml } from '../utils';
import { buttonClass, CLOSE_ICON, cx, ui } from './classes';
import { renderMarkdownBlock } from './feedback';

const ABOUT_MARKDOWN = `**StoryKeys** is a calm typing companion for learners who benefit from gentle practice. It pairs curated stories with mindful drills so building muscle memory feels encouraging.

This project is designed to respect privacy, celebrate small wins, and make it easy for teachers, parents, and independent learners to explore accessible typing journeys.`;

const LICENSE_TEXT = `MIT License

Copyright (c) 2025 Philip Leichauer

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`;

function closeButton(): string {
  return `<button id="close-modal-btn" type="button" class="${cx(ui.iconButton, 'shrink-0 -mt-1 -mr-1')}" title="Close" aria-label="Close">${CLOSE_ICON}</button>`;
}

function header(id: string, title: string): string {
  return `<div class="${ui.modalHeader}"><h2 id="${id}" class="${ui.modalTitle}">${escapeHtml(title)}</h2>${closeButton()}</div>`;
}

const rangeInput = 'w-[130px] accent-sk-accent cursor-pointer';
const pinInput = 'w-[110px] text-center px-3 py-2.5 min-h-11 border-2 border-sk-border rounded-xl bg-sk-card text-sk-text';
const settingItem = 'flex justify-between items-center gap-4 py-3.5 flex-wrap border-b border-sk-border last:border-0';
const settingHelp = 'm-0 text-sk-muted text-[0.88rem] max-w-none';
const infoBlock = 'border border-sk-border rounded-xl p-5 bg-sk-subtle';
const groupSummary = 'flex items-center justify-between gap-2 font-bold text-[1.1rem] cursor-pointer min-h-11 list-none';

/** One settings row: label, helper text, and its control. */
function setting(label: string, help: string, control: string): string {
  return `<div class="${settingItem}">
                        <div class="min-w-0">
                            <b>${escapeHtml(label)}</b>
                            <p class="${settingHelp}">${escapeHtml(help)}</p>
                        </div>
                        ${control}
                    </div>`;
}

function toggleControl(id: string, label: string): string {
  return `<label class="${ui.toggle}"><span class="sr-only">${escapeHtml(label)}</span><input type="checkbox" id="${id}"><span class="slider"></span></label>`;
}

function selectControl(id: string, options: Array<[string, string]>): string {
  return `<select id="${id}" class="${cx(ui.field, 'min-w-[9rem]')}">${
    options.map(([value, text]) => `<option value="${value}">${escapeHtml(text)}</option>`).join('')
  }</select>`;
}

function group(title: string, body: string, open = true): string {
  return `<details class="group border border-sk-border rounded-xl px-4 py-2" ${open ? 'open' : ''}>
                    <summary class="${groupSummary}">
                        <span>${escapeHtml(title)}</span>
                        <svg viewBox="0 0 24 24" class="w-5 h-5 fill-current shrink-0 text-sk-muted transition-transform duration-200 group-open:rotate-180" aria-hidden="true"><path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z"/></svg>
                    </summary>
                    <div class="pb-2">${body}</div>
                </details>`;
}

export function getModalHtml(modalName: ModalName, state: AppState, data: AppData): string {
  switch (modalName) {
    case 'welcome':
      return `
            <div class="${ui.modal}" id="welcome-modal" role="dialog" aria-modal="true" aria-labelledby="welcome-title"><div class="${cx(ui.modalContent, 'gap-4')}">
                ${header('welcome-title', 'Welcome to StoryKeys')}
                <p class="text-[1.05rem] text-sk-muted m-0">A calm, dyslexia-friendly space to build confident typing skills.</p>
                <ul class="list-none p-0 m-0 grid gap-3">
                    <li class="flex gap-3 items-start"><span class="text-xl shrink-0" aria-hidden="true">📖</span><span><b>Pick a lesson</b> — stories, spelling lists, letter sounds, or word sets.</span></li>
                    <li class="flex gap-3 items-start"><span class="text-xl shrink-0" aria-hidden="true">🔊</span><span><b>Listen first</b> — tap Read aloud to hear the words before you start.</span></li>
                    <li class="flex gap-3 items-start"><span class="text-xl shrink-0" aria-hidden="true">🐢</span><span><b>Go at your pace</b> — the timer only starts when you press your first key.</span></li>
                    <li class="flex gap-3 items-start"><span class="text-xl shrink-0" aria-hidden="true">🏅</span><span><b>Earn badges</b> — celebrate every milestone along the way.</span></li>
                    <li class="flex gap-3 items-start"><span class="text-xl shrink-0" aria-hidden="true">🎨</span><span><b>Make it yours</b> — change colours, fonts and spacing in Settings.</span></li>
                </ul>
                <p class="text-sm text-sk-muted m-0">Everything stays on this device. No account needed.</p>
                <div class="${ui.modalFooter}">
                    <button id="welcome-start-btn" type="button" class="${buttonClass('primary', 'lg')}">Let's start</button>
                </div>
            </div></div>`;

    case 'help':
      return `
            <div class="${ui.modal}" role="dialog" aria-modal="true" aria-labelledby="help-title"><div class="${ui.modalContent}">
                ${header('help-title', 'Need a hand?')}
                <div class="${infoBlock}">
                    <h3 class="mt-0">What is StoryKeys?</h3>
                    <p class="mb-0">StoryKeys is a reading and typing practice tool that uses short stories to build confidence and rhythm. It keeps things calm so you can focus on accuracy first, then speed.</p>
                </div>
                <div class="${infoBlock}">
                    <h3 class="mt-0">How to use it</h3>
                    <ol class="pl-[1.2rem] m-0 grid gap-1">
                        <li>Choose a story.</li>
                        <li>Type the words you see.</li>
                        <li>Aim for accuracy first, then speed.</li>
                    </ol>
                </div>
                <div class="${infoBlock}">
                    <h3 class="mt-0">Features that help</h3>
                    <ul class="pl-[1.2rem] m-0 grid gap-1">
                        <li><b>Focus line</b> — dims everything except the line you are on.</li>
                        <li><b>Lockstep</b> — waits for the right letter before moving on.</li>
                        <li><b>Read aloud</b> — hears the passage for you before you type.</li>
                        <li><b>Finger guide</b> — shows which finger to reach with.</li>
                    </ul>
                </div>
                <div class="${infoBlock}" id="help-data-privacy">
                    <h3 class="mt-0">Data &amp; privacy</h3>
                    <ul class="pl-[1.2rem] m-0 grid gap-1">
                        <li>Progress is stored only in this browser, using localStorage.</li>
                        <li>No accounts, no cloud storage, no third-party trackers.</li>
                        <li>You can export or erase local data from Parent Glance.</li>
                    </ul>
                </div>
                <div class="${infoBlock}">
                    <h3 class="mt-0">Tips</h3>
                    <ul class="pl-[1.2rem] m-0 grid gap-1">
                        <li>Take your time. Accuracy comes first.</li>
                        <li>Keep your fingers resting on the home row.</li>
                        <li>Green letters mean you got it right.</li>
                        <li>Short breaks help hands and eyes stay fresh.</li>
                    </ul>
                </div>
                <div class="${infoBlock}">
                    <h3 class="mt-0">Keyboard shortcuts</h3>
                    <ul class="list-none p-0 m-0 grid gap-2">
                        <li class="flex gap-4 items-center"><kbd class="min-w-[64px] text-center">Enter</kbd> Start lesson or try again</li>
                        <li class="flex gap-4 items-center"><kbd class="min-w-[64px] text-center">Esc</kbd> Pause typing, or go home</li>
                        <li class="flex gap-4 items-center"><kbd class="min-w-[64px] text-center">Space</kbd> Carry on when paused</li>
                    </ul>
                </div>
                <div class="${infoBlock}">
                    <h3 class="mt-0">About StoryKeys</h3>
                    <div>${renderMarkdownBlock(ABOUT_MARKDOWN)}</div>
                </div>
                ${group('License', `<pre class="bg-sk-card border border-sk-border rounded-xl p-4 whitespace-pre-wrap overflow-x-auto font-mono text-xs m-0 mt-2">${escapeHtml(LICENSE_TEXT)}</pre>`, false)}
            </div></div>`;

    case 'badges': {
      const earnedBadges = state.progress.badges.map((entry) => {
        const badge = data.BADGES.find((b) => b.id === entry.id) || { label: entry.id, desc: 'Badge earned.' };
        const earnedDate = entry.earnedAt ? new Date(entry.earnedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
        const dateLine = earnedDate ? `<span class="block text-xs text-sk-muted mt-1.5">Earned ${escapeHtml(earnedDate)}</span>` : '';
        return `<div class="flex gap-3 items-start border border-sk-border rounded-xl p-4 bg-sk-subtle text-left">
                    <span class="text-2xl shrink-0" aria-hidden="true">🏅</span>
                    <span class="min-w-0">
                        <span class="block font-bold">${escapeHtml(badge.label)}</span>
                        <span class="block text-sm text-sk-muted">${escapeHtml(badge.desc)}</span>
                        ${dateLine}
                    </span>
                </div>`;
      });
      const hasBadges = earnedBadges.length > 0;
      const total = data.BADGES.filter((b) => !b._comment && !b.hidden).length;
      return `
            <div class="${ui.modal}" role="dialog" aria-modal="true" aria-labelledby="badges-title"><div class="${ui.modalContent}">
                ${header('badges-title', 'Your badges')}
                ${hasBadges
                  ? `<p class="${ui.eyebrow}">${earnedBadges.length} of ${total} earned</p>
                     <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">${earnedBadges.join('')}</div>
                     <div class="${ui.modalFooter}"><button id="print-certificate-btn" type="button" class="${buttonClass('secondary')}"><span aria-hidden="true">🎓</span> Print certificate</button></div>`
                  : `<div class="text-center py-6">
                        <div class="text-5xl mb-3" aria-hidden="true">🏅</div>
                        <p class="m-0 mx-auto text-sk-muted">No badges yet. Finish a lesson and your first one will appear here.</p>
                     </div>`}
            </div></div>`;
    }

    case 'lessonPicker':
      return `
            <div class="${ui.modal}" role="dialog" aria-modal="true" aria-labelledby="lesson-picker-title"><div class="${cx(ui.modalContent, 'lesson-picker-modal w-[min(920px,95%)] gap-4')}">
                ${header('lesson-picker-title', data.COPY.homeChangeLesson)}
                <div class="tabs flex gap-1 border-b border-sk-border overflow-x-auto -mt-1">
                    <button type="button" class="tab-button active" data-type="passage">Stories</button>
                    <button type="button" class="tab-button" data-type="phonics">Letter sounds</button>
                    <button type="button" class="tab-button" data-type="spelling">Spelling</button>
                    <button type="button" class="tab-button" data-type="wordset">Word sets</button>
                </div>
                <div class="flex gap-3 items-center flex-wrap">
                    <label class="${ui.eyebrow}" for="stage-filter-ks1">Key stage</label>
                    <div class="stage-filter flex flex-wrap gap-1.5">
                        <button type="button" class="${buttonClass('secondary', 'sm')}" data-stage="KS1" id="stage-filter-ks1">KS1</button>
                        <button type="button" class="${buttonClass('secondary', 'sm')}" data-stage="KS2">KS2</button>
                        <button type="button" class="${buttonClass('secondary', 'sm')}" data-stage="KS3">KS3</button>
                        <button type="button" class="${buttonClass('secondary', 'sm')}" data-stage="KS4">KS4</button>
                    </div>
                </div>
                <div class="flex gap-2 sm:gap-3 flex-wrap">
                    <label class="sr-only" for="search-input">Search lessons</label>
                    <input type="search" id="search-input" class="${cx(ui.field, 'grow min-w-[11rem] cursor-text')}" placeholder="Search by title or theme…">
                    <label class="sr-only" for="status-filter">Filter by status</label>
                    <select id="status-filter" class="${ui.field}">
                        <option value="all">All</option>
                        <option value="complete">Finished</option>
                        <option value="todo">Not yet done</option>
                    </select>
                    <label class="sr-only" for="sort-select">Sort lessons</label>
                    <select id="sort-select" class="${ui.field}">
                        <option value="title">Sort: title</option>
                        <option value="length">Sort: length</option>
                        <option value="theme">Sort: theme</option>
                    </select>
                </div>
                <div class="lesson-list grow overflow-y-auto overscroll-contain min-h-[240px] sm:min-h-[360px] max-h-[50vh] sm:max-h-[420px] -mx-1 px-1"></div>
                <div class="pagination-controls flex justify-between items-center gap-3 pt-3 border-t border-sk-border"></div>
            </div></div>`;

    case 'settings':
      return `
            <div class="${ui.modal}" role="dialog" aria-modal="true" aria-labelledby="settings-title"><div class="${ui.modalContent}">
                ${header('settings-title', 'Settings')}
                ${group('Look and feel', [
                  setting('Colours', 'Change the app\'s colour scheme.', selectControl('setting-theme', [['cream', 'Cream'], ['light', 'Light'], ['dark', 'Dark']])),
                  setting('Font', 'Choose a clearer font for reading.', selectControl('setting-font', [['default', 'Default'], ['dyslexia', 'Clear (Arial)'], ['opendyslexic', 'OpenDyslexic']])),
                  setting('Line spacing', 'Space between lines of text.', `<div class="flex items-center gap-3"><span id="lh-val" class="tabular-nums text-sk-muted min-w-[2.5rem] text-right"></span><input type="range" id="setting-line-height" min="1.4" max="2.0" step="0.1" class="${rangeInput}"></div>`),
                  setting('Letter spacing', 'Space between letters.', `<div class="flex items-center gap-3"><span id="ls-val" class="tabular-nums text-sk-muted min-w-[2.5rem] text-right"></span><input type="range" id="setting-letter-spacing" min="0" max="8" step="1" class="${rangeInput}"></div>`),
                  setting('Reduce motion', 'Turn off animations and effects.', toggleControl('setting-reduce-motion', 'Reduce motion')),
                ].join(''))}
                ${group('Typing helpers', [
                  setting('Lockstep', 'Wait for the right letter before moving on.', toggleControl('setting-lockstep', 'Lockstep')),
                  setting('Focus line', 'Dim every line except the current one.', toggleControl('setting-focusline', 'Focus line')),
                  setting('On-screen keyboard', 'Show a keyboard with the next key lit up.', toggleControl('setting-keyboard', 'On-screen keyboard')),
                  setting('Finger guide', 'Show which finger to use.', toggleControl('setting-finger-guide', 'Finger guide')),
                ].join(''))}
                ${group('Sound and speech', [
                  setting('Typing sounds', 'Play soft clicks while typing.', toggleControl('setting-sound', 'Typing sounds')),
                  setting('Read aloud voice', 'Voice used to read passages.', selectControl('setting-voice-gender', [['female', 'Female'], ['male', 'Male']])),
                  setting('Reading speed', 'How fast text is read aloud.', `<div class="flex items-center gap-3"><span id="vs-val" class="tabular-nums text-sk-muted min-w-[3rem] text-right"></span><input type="range" id="setting-voice-speed" min="0.5" max="1.2" step="0.05" class="${rangeInput}"></div>`),
                ].join(''))}
                ${group('For grown-ups', [
                  setting('Key stage', 'Used for the main buttons on the home screen.', selectControl('setting-default-stage', [['KS1', 'KS1'], ['KS2', 'KS2'], ['KS3', 'KS3'], ['KS4', 'KS4']])),
                  setting('Show timer', 'Display a timer during lessons.', toggleControl('setting-timer-display', 'Show timer')),
                  setting('Parent PIN', 'Protect Parent Glance with 4 digits.', `<input type="password" id="setting-pin" class="${pinInput}" maxlength="4" placeholder="0000" inputmode="numeric" autocomplete="new-password">`),
                ].join(''), false)}
                <div class="${ui.modalFooter}">
                    <button id="save-settings-btn" type="button" class="${buttonClass('primary', 'lg')}">Save and close</button>
                </div>
            </div></div>`;

    case 'parent': {
      const weeklySessions = state.sessions.filter((s) => (Date.now() - new Date(s.ts).getTime()) < 7 * 24 * 60 * 60 * 1000);
      const avgAccuracy = weeklySessions.length
        ? `${Math.round(weeklySessions.reduce((acc, s) => acc + s.accuracy, 0) / weeklySessions.length)}%`
        : '—';
      const stat = (label: string, value: string) => `<div class="bg-sk-subtle border border-sk-border rounded-xl p-4 text-center">
                        <p class="${ui.eyebrow}">${escapeHtml(label)}</p>
                        <p class="metric-value text-[1.8rem] m-0 mt-1">${escapeHtml(value)}</p>
                    </div>`;
      return `
            <div class="${ui.modal}" role="dialog" aria-modal="true" aria-labelledby="parent-title"><div class="${ui.modalContent}">
                ${header('parent-title', 'Parent Glance')}
                <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    ${stat('Sessions this week', String(weeklySessions.length))}
                    ${stat('Average accuracy', avgAccuracy)}
                    ${stat('Total minutes', String(Math.round(state.progress.minutesTotal)))}
                </div>
                <div>
                    <p class="${ui.eyebrow}">Recent sessions</p>
                    <div class="max-h-[220px] overflow-y-auto border border-sk-border rounded-xl mt-2 divide-y divide-sk-border">${
                      state.sessions.slice(-10).reverse().map((s) => {
                        const wpmText = typeof s.netWPM === 'number' ? `${s.netWPM} wpm` : '– wpm';
                        return `<div class="flex justify-between items-center gap-3 px-3 py-2.5 text-sm">
                            <span class="min-w-0 truncate">${escapeHtml(s.title || s.contentId)}</span>
                            <span class="shrink-0 text-sk-muted tabular-nums">${s.accuracy}% · ${escapeHtml(wpmText)}</span>
                        </div>`;
                      }).join('') || '<p class="m-0 p-4 text-sk-muted">No sessions yet.</p>'
                    }</div>
                </div>
                <div class="${cx(ui.buttonRow, 'mt-1')}">
                    <button id="export-btn" type="button" class="${buttonClass('secondary')}">Export data</button>
                    <button id="clear-data-btn" type="button" class="${buttonClass('danger')}">Clear all data</button>
                </div>
            </div></div>`;
    }

    case 'pin':
      return `
            <div class="${ui.modal}" role="dialog" aria-modal="true" aria-labelledby="pin-title"><div class="${cx(ui.modalContent, 'w-[420px] text-center')}">
                ${header('pin-title', 'Enter PIN')}
                <p class="m-0 mx-auto text-sk-muted">This area is for grown-ups.</p>
                <label class="sr-only" for="pin-input">Four digit PIN</label>
                <input type="password" id="pin-input" data-autofocus class="${cx(pinInput, 'mx-auto text-3xl tracking-[0.3em] w-[170px]')}" maxlength="4" inputmode="numeric" autocomplete="one-time-code">
                <div class="${ui.modalFooter}">
                    <button id="pin-submit-btn" type="button" class="${buttonClass('primary')}">Unlock</button>
                </div>
            </div></div>`;
  }
}
