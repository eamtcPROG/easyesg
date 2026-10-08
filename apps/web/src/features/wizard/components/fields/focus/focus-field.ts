/**
 * **Focus into the field an address names** (task 42.3; FR-42 item 1, UX-22, `design_spec.md` §10.4) — the step half
 * of a finding's address: the fragment is the field's anchor (`fieldAnchor`), the id its visible label carries, and the
 * field is the group that label names.
 *
 * **Focus lands in the control, not on the label**: the checked option of a choice, else the field's first control,
 * so the reporter can answer at once and a screen reader announces the question with it. A derived figure has no
 * control, and then the group itself takes focus — made focusable for that, never a tab stop. **It scrolls the field
 * into view first, centred**, so the question, its control and the finding beneath it are all on screen whatever the
 * step's sticky parts cover, and focus then moves without a second jump. Scrolling alone would be §10.4's failure.
 *
 * Answers whether it found the field, so a fragment that names nothing on this step is left to the browser.
 */
const CONTROL = [
  'input:not([type="hidden"]):not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'button:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

export function focusField(input: { readonly document: Document; readonly hash: string }): boolean {
  const anchor = input.hash.startsWith('#') ? input.hash.slice(1) : input.hash;
  if (anchor === '') return false;
  const field = input.document.getElementById(anchor)?.closest<HTMLElement>('[role="group"]') ?? null;
  if (field === null) return false;

  field.scrollIntoView({ block: 'center' });
  const control =
    field.querySelector<HTMLElement>('input[type="radio"]:checked:not([disabled])') ??
    field.querySelector<HTMLElement>(CONTROL);
  if (control !== null) {
    control.focus({ preventScroll: true });
    return true;
  }
  field.setAttribute('tabindex', '-1');
  field.focus({ preventScroll: true });
  return true;
}
