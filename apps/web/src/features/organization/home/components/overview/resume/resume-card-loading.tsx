import { Skeleton, SKELETON_SHAPE } from '@easyesg/ui';
import styles from '../../styles/home.module.css';

/** One bar per module of a Basic report — the commonest strip, and the loading artboard's eleven. */
const STRIP_CELLS = Array.from({ length: 11 }, (_, index) => `cell-${index}`);

/**
 * The resume card's `loading — initial` (§8.1; task 255): the card's own insets, the eyebrow's and the title's lines,
 * the strip at its full width and the button's block — the loading artboard's *structure first, figures second*. The
 * strip keeps its geometry while it loads, so nothing moves under the pointer when the figures arrive.
 *
 * **It may not do I/O** (`apps/web/CLAUDE.md`'s fallback trap), and it does none: no translator either, since the
 * overview's fallback already announces the wait and a second status here would say it twice.
 */
export function ResumeCardLoading() {
  return (
    <div className={`${styles.card} ${styles.emphatic} ${styles.cardInset}`}>
      <Skeleton className={styles.loadingEyebrow} />
      <Skeleton shape={SKELETON_SHAPE.HEADING} className={styles.loadingResumeTitle} />
      <div className={styles.loadingStrip}>
        {STRIP_CELLS.map((key) => (
          <Skeleton key={key} shape={SKELETON_SHAPE.BLOCK} />
        ))}
      </div>
      <Skeleton shape={SKELETON_SHAPE.BLOCK} className={styles.loadingAction} />
    </div>
  );
}
