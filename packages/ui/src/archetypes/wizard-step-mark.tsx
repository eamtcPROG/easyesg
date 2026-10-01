import { Ban, Check, Minus } from 'lucide-react';
import type { ReactNode } from 'react';
import { WIZARD_STEP_STATE, type WizardStepState } from './wizard-step-vocabulary';
import styles from './wizard-step-mark.module.css';

/**
 * The mark a step wears — the square the Reporting Core rail draws before each module, and the strip draws on each
 * chip (task 179.1).
 *
 * **Decoration beside the words, never instead of them**: it is hidden from assistive technology, and every place it
 * is drawn carries the state in words too — the rail's line, the chip's description. So it can be a glyph without an
 * accessible name, which is what keeps *"never colour alone"* true for sighted readers without saying it twice to a
 * screen reader.
 *
 * **Its own file because several parts draw it** — the rail's row, the strip's chip and, since task 179.3, the step
 * heading's state — and a state drawn more than one way is the drift the artboard's one vocabulary exists to prevent.
 */
const GLYPHS: Record<WizardStepState, ReactNode> = {
  [WIZARD_STEP_STATE.COMPLETE]: <Check className={styles.icon} strokeWidth={2.5} />,
  [WIZARD_STEP_STATE.IN_PROGRESS]: '!',
  [WIZARD_STEP_STATE.NOT_STARTED]: null,
  [WIZARD_STEP_STATE.OMITTED]: <Ban className={styles.icon} strokeWidth={2.25} />,
  [WIZARD_STEP_STATE.WAITING]: '◦',
  [WIZARD_STEP_STATE.INAPPLICABLE]: <Minus className={styles.icon} strokeWidth={2.5} />,
};

export function WizardStepMark({ state }: { readonly state: WizardStepState }) {
  return (
    <span className={styles.mark} data-state={state} aria-hidden="true">
      {GLYPHS[state]}
    </span>
  );
}
