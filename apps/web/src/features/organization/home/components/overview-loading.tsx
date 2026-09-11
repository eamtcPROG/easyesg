import { Panel, Skeleton, SKELETON_SHAPE } from '@easyesg/ui';
import { getTranslations } from 'next-intl/server';
import { OVERVIEW_MESSAGES } from './overview-messages';
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
 * **It resolves its own sentence, like every other region on this screen** (project owner). An
 * earlier draft took the label as a prop, on the rule that *"a fallback may not await"* — and that
 * rule was overstated in the one way that mattered. A fallback which suspends is resolved against
 * the **parent** boundary, so the shell does wait for it; what it waits for here is
 * `getTranslations`, a catalogue the request has already resolved for the page, the heading and the
 * membership list. It is a microtask, not the `GET /periods` round trip this boundary exists to
 * stream past, and conflating the two is what the old sentence did.
 *
 * **What would make it wrong is I/O, and that is the rule worth keeping**: a fallback that reads
 * anything over the wire blocks the shell on exactly the thing the boundary was added to stop
 * blocking on. A message lookup is not that. The gain is that S-05's route file resolves no strings
 * at all now — it is a shell that composes five components and nothing else.
 *
 * **The bars are `aria-hidden` and one sentence carries the wait.** A screen reader hears *"the
 * reporting status is loading"* once, rather than counting grey rectangles (UX-102); the sentence is
 * visually hidden because the skeleton is what a sighted reader is already being told by.
 */
export async function OverviewLoading() {
  const t = await getTranslations(OVERVIEW_MESSAGES);

  return (
    <Panel>
      <p className={styles.loadingLabel} role="status">
        {t('loading')}
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
