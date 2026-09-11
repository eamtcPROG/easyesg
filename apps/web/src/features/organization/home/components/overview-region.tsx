import { Panel } from '@easyesg/ui';
import type { ReactNode } from 'react';
import styles from './home.module.css';

/**
 * The anatomy every region of S-05's overview shares: a `Panel` and the `h2` that names its
 * question.
 *
 * **Four callers, and it exists because the heading is the part that must not drift.** UX-6 orders
 * three questions and each is a level-2 heading under the screen's one `h1`, so the level is not a
 * per-region choice — `RecordShell` makes the same argument for its sections in `packages/ui`
 * (*"an `<h2>` because the shell owns the `<h1>` — the level is not the caller's to choose"*). Before
 * the split the incantation `t-heading-3 ${styles.regionHeading}` was written out four times, which
 * is four places for a heading to become an `h3` by accident.
 *
 * **Not an inventory addition, and the distinction is UX-89's own.** §11.5's `Panel` is the
 * component; this is one screen's composition of it with a heading, so it belongs beside the screen
 * rather than in `packages/ui`. It has no states, no variants and no props but its two slots — the
 * moment it grows a boolean, the split is wrong rather than the component being short of a flag.
 */
export function OverviewRegion({
  heading,
  children,
}: {
  /** Localized by the caller: this file owns no namespace, so it cannot pick the wrong key. */
  readonly heading: string;
  readonly children: ReactNode;
}) {
  return (
    <Panel>
      <h2 className={`t-heading-3 ${styles.regionHeading}`}>{heading}</h2>
      {children}
    </Panel>
  );
}
