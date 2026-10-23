import type { ReactNode } from 'react';
import type { MarketingAnchor } from './marketing-anchors';
import styles from './marketing-band.module.css';

/**
 * The surfaces S-29's bands alternate between — the Public Home artboard's white, slate and pine-tint bands, as the
 * cascade's default, sunken and accent-tint roles, so the dark scheme reaches them with no styles of their own.
 */
export const BAND_SURFACE = {
  DEFAULT: 'default',
  SUNKEN: 'sunken',
  TINT: 'tint',
} as const;

export type BandSurface = (typeof BAND_SURFACE)[keyof typeof BAND_SURFACE];

/**
 * One full-width band of the marketing home — `design_spec.md` S-29's *"full-width banded sections over the
 * `--content-max` measure"*: an addressable `<section>` named by its `<h2>`, the eyebrow and the lede above whatever
 * the band holds.
 *
 * **The home's own, not `ContentShell`'s** (UX-89's third move). The Content archetype's frame is the legal set's
 * reading column — one head band, then text at 70ch — and the home is a stack of bands the width of the window, each
 * on its own surface. That is a difference in anatomy, and only this screen draws it, so it lives beside the screen
 * and moves to `packages/ui` the day a second one needs it.
 *
 * In `shared/` because five of the home's bands are drawn on it.
 */
export function MarketingBand({
  id,
  surface,
  eyebrow,
  title,
  lede,
  children,
}: {
  readonly id: MarketingAnchor;
  readonly surface: BandSurface;
  readonly eyebrow: ReactNode;
  readonly title: ReactNode;
  readonly lede?: ReactNode;
  readonly children: ReactNode;
}) {
  const headingId = `${id}-heading`;

  return (
    <section id={id} aria-labelledby={headingId} className={styles.band} data-surface={surface}>
      <div className={styles.measure}>
        <hgroup className={styles.head}>
          <p className={styles.eyebrow}>{eyebrow}</p>
          <h2 id={headingId} className={`t-heading-1 ${styles.title}`}>
            {title}
          </h2>
          {lede ? <p className={`t-body ${styles.lede}`}>{lede}</p> : null}
        </hgroup>
        {children}
      </div>
    </section>
  );
}
