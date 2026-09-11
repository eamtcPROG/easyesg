import { Panel, Skeleton, SKELETON_SHAPE } from '@easyesg/ui';
import styles from './home.module.css';

/**
 * The boundary's fallback — §8.1's `loading — initial`, which the model defines as *"skeleton
 * matching final layout; no layout shift on resolve"* and S-05's own row repeats verbatim.
 *
 * **It matches the region's commonest shape rather than its widest**, which is the judgement
 * "matching the final layout" leaves once a region can resolve four ways. The three-panel answer is
 * what an organization with filings gets and what every reader sees on every visit after their
 * first; the other three — a teaching empty state, a permission callout, a recoverable-error
 * callout — are each a panel too, so the shift on those arms is a panel's height rather than a
 * screen's. **A spinner was built first and was wrong**: UX-115's second sentence reserves spinners
 * for *"indeterminate waits with no known shape"*, and this shape is known — the uncertainty is over
 * which of four, not over whether there is one.
 *
 * **Synchronous, and the labels arrive as props — a fallback may not await.** An async fallback is a
 * component that can itself suspend, and it would suspend against the *parent* boundary: the shell
 * would wait for exactly what the boundary below it exists to stop waiting for. That is why S-05's
 * route file still opens one translator after the split.
 *
 * **The bars are `aria-hidden` and one sentence carries the wait.** A screen reader hears *"the
 * reporting status is loading"* once, rather than counting grey rectangles (UX-102); the sentence is
 * visually hidden because the skeleton is what a sighted reader is already being told by.
 */
export function OverviewLoading({ label }: { readonly label: string }) {
  return (
    <Panel>
      <p className={styles.loadingLabel} role="status">
        {label}
      </p>
      <Skeleton shape={SKELETON_SHAPE.HEADING} className={styles.loadingHeading} />
      <Skeleton className={styles.loadingLede} />
      {/* Three rows: `FilingList`'s own shape, at the count an organization with one entity and
          three periods shows — the commonest filing list in the product, and the reason this
          resolves without moving anything under it. */}
      <div className={styles.loadingRows}>
        <Skeleton shape={SKELETON_SHAPE.BLOCK} />
        <Skeleton shape={SKELETON_SHAPE.BLOCK} />
        <Skeleton shape={SKELETON_SHAPE.BLOCK} />
      </div>
    </Panel>
  );
}
