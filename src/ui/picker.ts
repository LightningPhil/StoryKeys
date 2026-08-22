import { config } from '../config';
import { buildLessonId, getLessonCompletionPercent, getSectionCompletionPercent, isLastLesson } from '../progress/progress';
import type {
  AppData,
  AppState,
  LessonData,
  LessonPickerState,
  LessonPickerViewModel,
  LessonType,
  SortKey,
  StatusFilter,
} from '../types';
import { escapeHtml } from '../utils';
import { buttonClass } from './classes';
import { THEME_ICONS } from './screens';

let lessonPickerState: LessonPickerState = {
  searchTerm: '',
  sortKey: config.DEFAULT_SORT_KEY,
  statusFilter: 'all',
  currentPage: 1,
  currentType: 'passage',
  currentStage: 'KS2',
};

let lastRenderedState: AppState | null = null;
let lastRenderedData: AppData | null = null;
let hasAutoScrolledToLastLesson = false;

export function getLessonPickerState(): LessonPickerState {
  return lessonPickerState;
}

function getLessonLength(lesson: LessonData): number {
  if ('text' in lesson && lesson.text) return lesson.text.length;
  if ('words' in lesson && lesson.words) return lesson.words.join(' ').length;
  if ('items' in lesson && lesson.items) return lesson.items.join(' ').length;
  return 0;
}

function updateStageProgressBadges(state: AppState, data: AppData, type: LessonType): void {
  if (type === 'phonics') return;
  const stageButtons = document.querySelectorAll('.stage-filter [data-stage]');
  if (!stageButtons.length) return;

  stageButtons.forEach((btn) => {
    if (!(btn instanceof HTMLElement)) return;
    const stage = btn.dataset.stage;
    if (!stage) return;
    const percent = getSectionCompletionPercent(state, data, type, stage);
    let badge = btn.querySelector('.stage-progress');
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'stage-progress inline-block ml-1 px-1.5 py-0.5 rounded-full bg-sk-subtle text-xs';
      btn.appendChild(badge);
    }
    badge.textContent = `${percent}%`;
    if (badge instanceof HTMLElement) badge.title = `Average completion for ${stage}`;
  });
}

export function deriveLessonPickerViewModel(
  pickerState: LessonPickerState,
  state: AppState,
  data: AppData,
): LessonPickerViewModel {
  const { currentType, currentStage, searchTerm, sortKey, statusFilter, currentPage } = pickerState;
  const poolMap = {
    passage: data.PASSAGES,
    phonics: data.PHONICS,
    spelling: data.SPELLING,
    wordset: data.WORDSETS,
    drill: data.PASSAGES,
  };
  const pool = poolMap[currentType] || data.PASSAGES;

  const useStageFilter = currentType !== 'phonics';
  let filtered = useStageFilter ? pool.filter((l) => !l.stage || l.stage === currentStage) : [...pool];

  if (searchTerm) {
    const term = searchTerm.toLowerCase();
    filtered = filtered.filter((l) =>
      ((('title' in l && l.title) || ('name' in l && l.name) || '') as string).toLowerCase().includes(term)
      || (('theme' in l && l.theme) || '').toLowerCase().includes(term),
    );
  }

  if (statusFilter && statusFilter !== 'all') {
    filtered = filtered.filter((l) => {
      const lessonId = buildLessonId(currentType, l);
      const completionPercent = getLessonCompletionPercent(state, lessonId);
      if (statusFilter === 'complete') return completionPercent === 100;
      if (statusFilter === 'todo') return completionPercent < 100;
      return true;
    });
  }

  filtered.sort((a, b) => {
    if (sortKey === 'length') return getLessonLength(a) - getLessonLength(b);
    if (sortKey === 'theme') {
      const aTheme = 'theme' in a ? (a.theme || '') : '';
      const bTheme = 'theme' in b ? (b.theme || '') : '';
      return aTheme.localeCompare(bTheme);
    }
    const aTitle = ('title' in a && a.title) || ('name' in a && a.name) || '';
    const bTitle = ('title' in b && b.title) || ('name' in b && b.name) || '';
    return aTitle.localeCompare(bTitle);
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / config.LESSONS_PER_PAGE));
  const start = (currentPage - 1) * config.LESSONS_PER_PAGE;
  const pageItems = filtered.slice(start, start + config.LESSONS_PER_PAGE);

  const items = pageItems.map((l) => {
    const len = getLessonLength(l);
    const wordCount = 'words' in l && l.words ? l.words.length : Math.round(len / 5);
    const lessonId = buildLessonId(currentType, l);
    const completionPercent = getLessonCompletionPercent(state, lessonId);
    const tags = l.tags?.complexity ?? { caps: true, punct: true };
    const rawText = ('text' in l && l.text) || ('words' in l && l.words ? l.words.slice(0, 15).join(' ') : '');
    const preview = rawText.slice(0, 100) + (rawText.length > 100 ? '…' : '');
    const theme = 'theme' in l ? l.theme : undefined;
    const title = ('title' in l && l.title) || ('name' in l && l.name) || l.id || 'Lesson';

    return {
      id: l.id ?? '',
      type: currentType,
      lessonId,
      title,
      theme,
      icon: (theme && THEME_ICONS[theme]) || '📝',
      lenDisplay: `≈ ${len} chars / ${wordCount} words`,
      completionPercent,
      completionLabel: completionPercent === 100 ? 'Completed ✓' : `${completionPercent}% complete`,
      isComplete: completionPercent === 100,
      isLastVisited: isLastLesson(state, lessonId),
      hasCaps: Boolean(tags.caps),
      hasPunct: Boolean(tags.punct),
      preview,
    };
  });

  return {
    items,
    currentPage,
    totalPages,
    totalFiltered: filtered.length,
    hasNextPage: currentPage < totalPages,
    hasPrevPage: currentPage > 1,
    currentType,
    currentStage,
    lastLessonId: state.meta.lastLessonId || null,
  };
}

function renderLessonListDOM(vm: LessonPickerViewModel): void {
  const listEl = document.querySelector('.lesson-list');
  if (!listEl) return;

  if (vm.items.length === 0) {
    listEl.innerHTML = `<div class="text-center p-10">
            <div class="text-4xl mb-3" aria-hidden="true">🔍</div>
            <p class="m-0 mx-auto text-sk-muted">Nothing matched. Try a different search or key stage.</p>
        </div>`;
  } else {
    listEl.innerHTML = vm.items.map((item) => `
            <div class="lesson-item flex gap-3 items-center p-3 rounded-xl mb-1 hover:bg-sk-subtle" data-id="${item.id}" data-type="${item.type}" data-lesson-id="${item.lessonId}" title="${escapeHtml(item.preview)}">
                <div class="text-2xl shrink-0" aria-hidden="true">${item.icon}</div>
                <div class="grow min-w-0">
                    <b class="block">${escapeHtml(item.title)}</b>
                    <div class="flex gap-1.5 font-normal text-xs text-sk-muted mt-1 flex-wrap items-center">
                        ${item.theme ? `<span class="meta-chip">${escapeHtml(item.theme)}</span>` : ''}
                        <span class="meta-chip">${item.lenDisplay}</span>
                        ${item.hasCaps ? '<span class="meta-chip" title="Includes capital letters">Aa</span>' : ''}
                        ${item.hasPunct ? '<span class="meta-chip" title="Includes punctuation">.,!</span>' : ''}
                        <span class="meta-chip ${item.isComplete ? 'complete-chip' : 'progress-chip'}">${item.isComplete ? '✓ Finished' : item.completionLabel}</span>
                        ${item.isLastVisited ? '<span class="font-bold text-sk-accent">← Last visited</span>' : ''}
                    </div>
                </div>
                <button type="button" class="${buttonClass('primary', 'sm')} shrink-0" data-start="true">Start</button>
            </div>
        `).join('');
  }
  listEl.classList.remove('loading');
}

function renderPaginationDOM(vm: LessonPickerViewModel): void {
  const container = document.querySelector('.pagination-controls');
  if (!container) return;
  const showingAll = vm.totalPages <= 1;
  const pageText = showingAll
    ? `${vm.totalFiltered} lesson${vm.totalFiltered === 1 ? '' : 's'}`
    : `Page ${vm.currentPage} of ${vm.totalPages}`;
  container.innerHTML = `
        <button type="button" class="${buttonClass('secondary', 'sm')}" data-action="prev-page" ${!vm.hasPrevPage || showingAll ? 'disabled' : ''}>← Back</button>
        <span class="text-sm text-sk-muted tabular-nums">${pageText}</span>
        <button type="button" class="${buttonClass('secondary', 'sm')}" data-action="next-page" ${!vm.hasNextPage || showingAll ? 'disabled' : ''}>Next →</button>
    `;
}

export function renderLessonList(data: AppData, state: AppState): void {
  lastRenderedState = state;
  lastRenderedData = data;
  const vm = deriveLessonPickerViewModel(lessonPickerState, state, data);
  lessonPickerState._totalPages = vm.totalPages;
  updateStageProgressBadges(state, data, vm.currentType);
  renderLessonListDOM(vm);
  renderPaginationDOM(vm);

  if (!hasAutoScrolledToLastLesson && vm.lastLessonId) {
    const listEl = document.querySelector('.lesson-list');
    const target = listEl?.querySelector(`[data-lesson-id="${vm.lastLessonId}"]`);
    if (target) {
      target.scrollIntoView({ block: 'center', behavior: 'smooth' });
      hasAutoScrolledToLastLesson = true;
    }
  }
}

export function handleLessonPickerPagination(action: string): void {
  if (!lastRenderedData || !lastRenderedState) return;
  if (action === 'prev-page' && lessonPickerState.currentPage > 1) {
    lessonPickerState.currentPage--;
    renderLessonList(lastRenderedData, lastRenderedState);
  } else if (action === 'next-page' && lessonPickerState.currentPage < (lessonPickerState._totalPages ?? 1)) {
    lessonPickerState.currentPage++;
    renderLessonList(lastRenderedData, lastRenderedState);
  }
}

export function updateLessonPicker(
  updates: Partial<Pick<LessonPickerState, 'searchTerm' | 'sortKey' | 'statusFilter' | 'currentPage' | 'currentType' | 'currentStage'>>,
  state: AppState,
  data: AppData,
): void {
  if (updates.sortKey) {
    const allowed: SortKey[] = ['title', 'length', 'theme'];
    if (!allowed.includes(updates.sortKey)) delete updates.sortKey;
  }
  if (updates.statusFilter) {
    const allowed: StatusFilter[] = ['all', 'complete', 'todo'];
    if (!allowed.includes(updates.statusFilter)) delete updates.statusFilter;
  }
  Object.assign(lessonPickerState, updates);
  renderLessonList(data, state);
}

export function resetLessonPickerState(defaultStage: string): void {
  lessonPickerState = {
    searchTerm: '',
    sortKey: config.DEFAULT_SORT_KEY,
    statusFilter: 'all',
    currentPage: 1,
    currentType: 'passage',
    currentStage: defaultStage,
  };
  hasAutoScrolledToLastLesson = false;
}
