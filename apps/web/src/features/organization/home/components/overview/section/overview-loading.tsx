import { Skeleton } from '@easyesg/ui';
import { getTranslations } from 'next-intl/server';
import { ResumeCardLoading } from '../resume/resume-card-loading';
import { OVERVIEW_MESSAGES } from '../shared/overview-messages';
import styles from '../../styles/home.module.css';

/**
 * The boundary's fallback — §8.1's `loading — initial`, which the model defines as *"skeleton
 * matching final layout; no layout shift on resolve"* and S-05's own row repeats verbatim.
 *
 * **It matches the region's commonest shape rather than its widest**, which is the judgement
 * "matching the final layout" leaves once a region can resolve four ways. Since task 255 that shape is the loading
 * artboard's — *structure first, figures second*: the three questions' labels, two attention items, the resume card
 * with its strip at full width, and the table's rows — each in the slot on the board its region takes, so the
 * columns are already where they will be. The other three arms — a teaching empty state, a permission callout, a
 * recoverable-error callout — each replace the three with one card, so the shift on those arms is a card's height
 * rather than the board's. **A spinner was built first and was wrong**: UX-115's second sentence reserves spinners
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
 * at all now.
 *
 * **The bars are `aria-hidden` and one sentence carries the wait.** A screen reader hears *"the
 * reporting status is loading"* once, rather than counting grey rectangles (UX-102); the sentence is
 * visually hidden because the skeleton is what a sighted reader is already being told by.
 */
export async function OverviewLoading() {
  const t = await getTranslations(OVERVIEW_MESSAGES);

  return (
    <>
      <div className={`${styles.region} ${styles.attentionRegion}`}>
        <p className={styles.loadingLabel} role="status">
          {t('loading')}
        </p>
        <Skeleton className={styles.loadingRegionLabel} />
        <div className={styles.card}>
          {/* Two items: the loading artboard's count, and what a first filing period usually raises. */}
          <AttentionItemLoading />
          <AttentionItemLoading />
        </div>
      </div>
      <div className={`${styles.region} ${styles.resumeRegion}`}>
        <Skeleton className={styles.loadingRegionLabel} />
        <ResumeCardLoading />
      </div>
      <div className={`${styles.region} ${styles.everythingRegion}`}>
        <Skeleton className={styles.loadingRegionLabel} />
        <div className={styles.card}>
          <div className={styles.loadingItem}>
            <Skeleton className={styles.loadingLong} />
          </div>
          <div className={styles.loadingItem}>
            <Skeleton className={styles.loadingLong} />
          </div>
        </div>
      </div>
    </>
  );
}

/** One attention item's skeleton — the round mark and the item's two lines, at the item's own insets. */
function AttentionItemLoading() {
  return (
    <div className={styles.loadingItem}>
      <span className={styles.loadingMark} aria-hidden="true" />
      <div className={styles.loadingLines}>
        <Skeleton className={styles.loadingShort} />
        <Skeleton className={styles.loadingLong} />
      </div>
    </div>
  );
}
