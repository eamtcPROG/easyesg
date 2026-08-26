import type { ReactNode } from 'react';
import styles from './status-chip.module.css';

/**
 * Status chip — §11.5's Data display entry: a short, non-interactive label for the state a row is
 * in.
 *
 * **Tone is never the sole carrier (UX-102).** The chip always renders its own text, so a reader
 * who cannot distinguish the colours reads the state anyway; the tone is redundant emphasis and
 * nothing else. That is why there is no icon-only variant and no `title`-attribute form.
 *
 * `--radius-pill` is reserved by the token set for exactly this component ("status chips only"), so
 * a pill shape anywhere else in the product is a mistake with a name.
 *
 * **Not a Badge.** §11.5 lists both, and the split is what each is for: a Badge counts or marks
 * (unread, new), a Status chip names the state of the thing beside it. S-16 uses this one because
 * "active" and "pending invitation" are states, and the screen's whole job is telling them apart.
 */

/**
 * The tones, as an `as const` object with the union derived (CLAUDE.md, "Conventions"). They are
 * **semantic rather than chromatic** — `neutral` and not `grey` — so re-skinning edits tier 1 only
 * (UX-79) and a caller never encodes a colour choice at a call site.
 */
export const STATUS_TONE = {
  /** The ordinary, settled state. Nothing is asked of the reader. */
  NEUTRAL: 'neutral',
  /** Something is in flight and will resolve on its own, or by someone else's action. */
  PENDING: 'pending',
  /** Settled and good — access granted, a period closed, a payment taken. */
  POSITIVE: 'positive',
  /** Settled and not good, or lapsed. Never used for an error the reader must fix — that is a
   *  Callout, which carries the three parts a chip has no room for. */
  ATTENTION: 'attention',
} as const;

export type StatusTone = (typeof STATUS_TONE)[keyof typeof STATUS_TONE];

export interface StatusChipProps {
  tone: StatusTone;
  /** The state, in words. Localized by the caller, like every string in this package. */
  children: ReactNode;
}

export function StatusChip({ tone, children }: StatusChipProps) {
  return <span className={`${styles.chip} ${styles[tone]}`}>{children}</span>;
}
