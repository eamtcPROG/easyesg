import type { ReactNode } from 'react';
import styles from '../../styles/home.module.css';

/**
 * The anatomy UX-6's three regions share on the artboard (task 255): a small mono label naming the question, what it
 * counts at the label's end — *3 items*, *last saved …*, *All reports* — and the region's card beneath.
 *
 * **In `overview/shared/` on one test: is it read by more than one sibling?** `attention/`, `resume/`, `everything/`
 * and `states/` all read it. It was `components/shared/home-region.tsx` — a `Panel` and an `h2` — while the membership
 * list wore it too; the rail's cards are a different anatomy (`components/shared/rail-card.tsx`), so the last reader
 * outside the overview left and the file came back down to the level its readers share, under the name it had before
 * task 128 moved it up.
 *
 * **The heading is still the part that must not drift**: each question is a level-2 heading under the screen's one
 * `h1`, so the level is not a region's choice. What changed is its look — the artboard's quiet mono label rather
 * than a panel's title, since the card beneath is what carries the content's weight.
 *
 * **Not an inventory addition** (UX-89): one screen's composition of a heading and a card, with no states and no
 * variants. `place` is the region's slot on the board — which column it falls in and its order below `wide` — and is
 * the board's business, so the caller names it from the stylesheet rather than this file deciding it.
 */
export function OverviewRegion({
  heading,
  meta,
  place,
  children,
}: {
  /** Localized by the caller: this file owns no namespace, so it cannot pick the wrong key. */
  readonly heading: string;
  /** What the region counts or links to, at the label's end. */
  readonly meta?: ReactNode;
  /** The board's class for this region (`styles.attentionRegion` …). */
  readonly place: string;
  readonly children: ReactNode;
}) {
  return (
    <section className={`${styles.region} ${place}`}>
      <div className={styles.regionHead}>
        <h2 className={styles.regionLabel}>{heading}</h2>
        {meta === undefined || meta === null ? null : (
          <span className={`t-caption ${styles.regionMeta}`}>{meta}</span>
        )}
      </div>
      {children}
    </section>
  );
}
