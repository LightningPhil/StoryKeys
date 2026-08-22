export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

const focusRing = 'focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-sk-accent';

export const ui = {
  // min-h keeps every control at a comfortable touch target for small hands.
  button: cx(
    'inline-flex items-center justify-center gap-2 min-h-12 px-5 py-3 text-base font-semibold',
    'no-underline text-center rounded-xl border-2 border-transparent cursor-pointer',
    'transition-[background-color,border-color,transform,opacity] duration-150',
    'hover:enabled:-translate-y-px active:enabled:translate-y-0',
    'disabled:opacity-45 disabled:cursor-not-allowed',
    focusRing,
  ),
  buttonPrimary: 'btn-primary',
  buttonSecondary: 'bg-sk-subtle border-sk-border text-sk-text hover:enabled:border-sk-accent',
  buttonQuiet: 'bg-transparent border-transparent text-sk-text hover:enabled:bg-sk-subtle',
  buttonDanger: 'bg-[#b32d24] text-white border-[#b32d24] hover:enabled:brightness-110',
  buttonPhonics: 'bg-[#bde5c8] text-[#12402f] border-[#a3d6b2] hover:enabled:border-[#12402f]',
  buttonSpelling: 'bg-[#b3dfe2] text-[#0f3c42] border-[#95ccd1] hover:enabled:border-[#0f3c42]',
  buttonSm: 'min-h-10 px-3.5 py-2 text-[0.9rem]',
  buttonLg: 'min-h-14 px-7 text-[1.15rem] font-bold rounded-2xl',
  buttonBlock: 'w-full',

  iconButton: cx(
    'bg-transparent border-0 cursor-pointer size-11 rounded-full inline-flex items-center justify-center',
    'text-sk-muted hover:bg-sk-subtle hover:text-sk-text transition-colors duration-150',
    '[&>svg]:w-6 [&>svg]:h-6 [&>svg]:fill-current',
    focusRing,
  ),

  card: 'card p-5 sm:p-7',
  cardTight: 'card p-4 sm:p-5',
  tile: 'tile',
  sectionTitle: 'text-[1.35rem] sm:text-[1.5rem] font-bold m-0',
  lead: 'text-sk-muted m-0',
  eyebrow: 'eyebrow',

  buttonRow: 'flex flex-wrap items-center gap-3',
  buttonRowCenter: 'flex flex-wrap items-center justify-center gap-3',
  buttonGroup: 'flex flex-wrap items-center gap-2 sm:gap-3',
  stageRow: 'flex flex-col sm:flex-row gap-2 items-stretch',
  textLink: cx('bg-transparent border-0 text-sk-accent cursor-pointer font-semibold p-0 underline', focusRing),

  modal: 'modal fixed inset-0 z-[100] hidden items-center justify-center bg-black/55 p-3 sm:p-5',
  modalActive: 'flex',
  modalContent: cx(
    'modal-content bg-sk-card rounded-2xl border border-sk-border',
    'p-5 sm:p-7 max-w-[95%] w-[640px] max-h-[90vh] overflow-y-auto overscroll-contain',
    'flex flex-col gap-5',
  ),
  modalHeader: 'flex justify-between items-start gap-4 shrink-0 pb-4 border-b border-sk-border',
  modalTitle: 'text-[1.4rem] sm:text-[1.6rem] font-bold tracking-tight m-0',
  modalFooter: 'mt-1 flex justify-center flex-wrap gap-3',

  toggle: cx(
    'toggle-switch inline-flex items-center gap-2.5 cursor-pointer select-none',
    'text-[0.95rem] font-semibold rounded-full py-1.5 px-2 hover:bg-sk-subtle transition-colors duration-150',
  ),
  field: 'text-base px-3 py-2.5 min-h-11 border-2 border-sk-border rounded-xl bg-sk-card text-sk-text cursor-pointer hover:border-sk-accent transition-colors duration-150',
};

export function buttonClass(
  ...variants: Array<'primary' | 'secondary' | 'quiet' | 'danger' | 'phonics' | 'spelling' | 'sm' | 'lg' | 'block'>
): string {
  const map = {
    primary: ui.buttonPrimary,
    secondary: ui.buttonSecondary,
    quiet: ui.buttonQuiet,
    danger: ui.buttonDanger,
    phonics: ui.buttonPhonics,
    spelling: ui.buttonSpelling,
    sm: ui.buttonSm,
    lg: ui.buttonLg,
    block: ui.buttonBlock,
  };
  return cx(ui.button, ...variants.map((v) => map[v]));
}

export const CLOSE_ICON = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"></path></svg>`;
