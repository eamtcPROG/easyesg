import { Skeleton, SKELETON_SHAPE } from '@easyesg/ui';
import styles from '../styles/home.module.css';

/**
 * `DeadlineSection`'s §8.1 `loading — initial` (task 255): the rail card's insets, its eyebrow's bar, the date's
 * heading-height bar and a line for the sentence under it — the card's own geometry.
 *
 * **Whether it is ever seen is the composition's fact, not this file's.** The card awaits the same memoized rows as
 * the overview (`server/data/overview.ts`), so it resolves when they do; `e2e/web/home.spec.ts` measures what the
 * shell carries. It exists so the state is defined (UX-90). No status sentence: the overview's fallback announces
 * the wait once for the whole board.
 */
export function DeadlineLoading() {
  return (
    <div className={`${styles.card} ${styles.railCard}`}>
      <div className={styles.railCardInner}>
        <Skeleton className={styles.loadingEyebrow} />
        <Skeleton shape={SKELETON_SHAPE.HEADING} className={styles.loadingDate} />
        <Skeleton className={styles.loadingLong} />
      </div>
    </div>
  );
}
