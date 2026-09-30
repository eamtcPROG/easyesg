/**
 * The Wizard step list's states — `EasyESG Reporting Core.dc.html`'s *rail state vocabulary* (task 179.1), which
 * draws each one as *"icon, label and colour, never colour alone"*.
 *
 * **In a module of its own and without a directive**, the package's rule for every vocabulary: the step list is
 * rendered by Server Components and the switcher below `wide` is a Client Component, and an `as const` exported from a
 * `'use client'` module reaches a Server Component as `undefined`.
 *
 * **Six, where the artboard draws seven.** Its *In progress · n findings* is a validation verdict (task 42), and a
 * state with no producer is a screen state nothing can enter — so it arrives with its producer. What a caller derives
 * each state from is the caller's; this package draws them.
 */
export const WIZARD_STEP_STATE = {
  /** Every question answered. */
  COMPLETE: 'complete',
  /** Some answered, some outstanding. */
  IN_PROGRESS: 'in_progress',
  /** Nothing answered yet. */
  NOT_STARTED: 'not_started',
  /** Declared omitted by the reporter — UX-29's third value, neither complete nor incomplete. */
  OMITTED: 'omitted',
  /** Not applicable until an answer it depends on is given — *appears once B1 is complete* (UX-9). */
  WAITING: 'waiting',
  /** Ruled out by an answer already given (FR-28). */
  INAPPLICABLE: 'inapplicable',
} as const;

export type WizardStepState = (typeof WIZARD_STEP_STATE)[keyof typeof WIZARD_STEP_STATE];
