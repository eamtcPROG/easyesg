import { Skeleton } from '../primitives/skeleton';
import { SKELETON_SHAPE } from '../primitives/skeleton-vocabulary';
import styles from './enrolment-code.module.css';

/**
 * `EnrolmentCode`'s §8.1 `loading — initial` (task 143): the offer is fetched, and a region drawn
 * before it arrives draws this.
 *
 * **Over the same stylesheet, so the box does not move on resolve** (UX-115). The square is the
 * symbol's size, the block is the secret's, and the wrap that puts the symbol above the secret in a
 * narrow region does the same to its skeleton.
 *
 * **The label sits where the heading will**, because it is the one line whose place is known and
 * whose words are the caller's either way — and it is the `role="status"` a screen reader hears,
 * since every bar is `aria-hidden` (`Skeleton`'s own rule: the container names the wait, UX-102).
 *
 * **Defined whether or not a screen draws it**, because UX-90 makes an undefined state a defect. A
 * consumer that moves to its enrolment stage only once the offer has arrived waits on its own
 * control's `busy` instead, and draws nothing here.
 */
export interface EnrolmentCodeLoadingProps {
  /** Names the wait — the only part of this state a screen reader hears. */
  readonly label: string;
}

export function EnrolmentCodeLoading({ label }: EnrolmentCodeLoadingProps) {
  return (
    <div className={styles.code}>
      <Skeleton shape={SKELETON_SHAPE.BLOCK} className={styles.symbolLoading} />
      <div className={styles.manual}>
        <p className="t-label" role="status">
          {label}
        </p>
        <Skeleton shape={SKELETON_SHAPE.BLOCK} />
        <Skeleton className={styles.helpLoading} />
      </div>
    </div>
  );
}
