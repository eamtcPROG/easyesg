import type { ReactNode } from 'react';
import styles from './save-state-indicator.module.css';

/**
 * Save-state indicator — §11.5's Domain row, defined in §6.7 (task 35.2).
 *
 * UX-35: *"Save state shall be continuously visible in one fixed location with four states: saved,
 * saving, queued — no connection, failed. The indicator shall be text-labelled, not an icon alone,
 * and shall be announced to assistive technology on change."* The fixed location is the wizard
 * shell's `saveState` slot; this is what goes in it.
 *
 * **It is a live region, and it announces on transition only** (UX-112). The rendered text is a
 * function of `state`, so the region's content changes exactly when the state does — a keystroke
 * dispatches nothing, and an acknowledgement that lands inside NFR-38's budget never moves the
 * indicator off *saved*, so it says nothing at all (UX-36). Forty fields answered without a hitch is
 * forty silences, which is the noise rule met by construction rather than by throttling.
 *
 * **The four states are a closed vocabulary, and the label is the caller's.** This package owns no
 * text; what it owns is that a state cannot render without one — the `labels` record is total over
 * the vocabulary, so a fifth state fails to compile until it has words in every consumer.
 *
 * States (§8.1): the four above ARE this component's state set — `queued` is *offline / queued*,
 * `failed` is *error — recoverable* (the surrounding banner carries the retry, since a control inside
 * a live region would be announced with it on every transition), `saving` is *pending — async*, and
 * `saved` is *success*. It has no loading, empty or partial instance of its own: it reports on the
 * screen around it and never on itself.
 *
 * No colour is the sole carrier (UX-23): each state has its text and a mark, and the tone is the
 * cascade's own `--state-*` role or the tier-3 `--savestate-queued` token that already existed for
 * exactly this control.
 */
export const SAVE_STATE = {
  /** Every change acknowledged after a durable commit (NFR-56). */
  SAVED: 'saved',
  /** Something is unacknowledged and the budget has passed (UX-36). */
  SAVING: 'saving',
  /** Offline. The queue holds the changes and will send them (FR-38). */
  QUEUED: 'queued',
  /** The last attempt was refused or could not reach the API, and something is still unsent. */
  FAILED: 'failed',
} as const;

export type SaveState = (typeof SAVE_STATE)[keyof typeof SAVE_STATE];

/** A mark per state, so the state reads with colour removed (UX-23). Marks are not words. */
const MARKS: Record<SaveState, string> = {
  [SAVE_STATE.SAVED]: '✓',
  [SAVE_STATE.SAVING]: '…',
  [SAVE_STATE.QUEUED]: '⏸',
  [SAVE_STATE.FAILED]: '×',
};

export interface SaveStateIndicatorProps {
  state: SaveState;
  /** One localized label per state. Total, so an unlabelled state cannot render. */
  labels: Readonly<Record<SaveState, ReactNode>>;
  /** Names the region for assistive technology — "Save state", in the reader's language. */
  regionLabel: string;
}

export function SaveStateIndicator({ state, labels, regionLabel }: SaveStateIndicatorProps) {
  return (
    // `status` is implicitly `aria-live="polite"`; `aria-atomic` so a transition is read as one
    // phrase rather than as the mark and the label separately.
    <p
      className={styles.indicator}
      data-state={state}
      role="status"
      aria-atomic="true"
      aria-label={regionLabel}
    >
      <span className={styles.mark} aria-hidden="true">
        {MARKS[state]}
      </span>
      <span className={styles.label}>{labels[state]}</span>
    </p>
  );
}
