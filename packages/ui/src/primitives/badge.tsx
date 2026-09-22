import type { BadgeTone } from './badge-vocabulary';
import styles from './badge.module.css';

/**
 * Badge — §11.5's Primitive for a count or a mark (task 50.2.1; the unread count its first reader).
 *
 * **Not a Status chip.** §11.5 lists both, and `status-chip.tsx` records the split: a chip names the state of the
 * thing beside it, a badge counts. So this carries a number and nothing else, and never the chip's pill radius, which
 * the token set reserves for chips — `--radius-3` on a 20px badge already rounds its ends fully.
 *
 * **The number is drawn; the words are read.** A bare *4* tells a screen reader nothing about what is four, so where
 * the badge stands on its own the caller's `label` — *"4 unread notifications"* — is read instead of the digit.
 * Where something beside it already carries that sentence, as the bell's accessible name does, omit `label` and the
 * badge is hidden from assistive technology whole, rather than said twice.
 *
 * No text of its own and no formatting: a count of notices is a whole number a reader reads as digits in every
 * locale.
 *
 * States (§8.1, the applicable subset): rest only — a count is not interactive, and a caller with no count to show
 * renders no badge rather than a zero it does not know.
 */
export interface BadgeProps {
  readonly tone: BadgeTone;
  readonly count: number;
  /** What the count is, in words, localized by the caller. Omit it where the caller's own name already says so. */
  readonly label?: string;
}

export function Badge({ tone, count, label }: BadgeProps) {
  return (
    <span className={styles.badge} data-tone={tone} aria-hidden={label === undefined ? true : undefined}>
      <span aria-hidden="true">{count}</span>
      {label === undefined ? null : <span className={styles.assistive}>{label}</span>}
    </span>
  );
}
