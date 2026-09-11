import { Panel } from '@easyesg/ui';
import type { ReactNode } from 'react';
import styles from '../styles/home.module.css';

/**
 * The anatomy every region of S-05 shares: a `Panel` and the `h2` that names it.
 *
 * **Five callers now, and the fifth is why it moved** (task 128). It was `overview/shared/
 * overview-region.tsx` and belonged to one region; splitting `memberships-section.tsx` was about to
 * hand-copy `<Panel>` and `` `t-heading-3 ${styles.regionHeading}` `` into a new file for the fifth
 * time, which is the duplication the component was created to end — *"this should be done in one
 * place"*, the project owner's first correction of this session. So it rose one level, to the folder
 * both regions can see, and lost the `Overview` in its name because it was never about the overview.
 *
 * **The heading is the part that must not drift.** UX-6 orders three questions and the membership
 * list is a fourth region; each is a level-2 heading under the screen's one `h1`, so the level is
 * not a per-region choice — `RecordShell` makes the same argument for its sections in `packages/ui`
 * (*"an `<h2>` because the shell owns the `<h1>` — the level is not the caller's to choose"*).
 * Before the overview's split the incantation was written out four times, which is four places for
 * an `h2` to become an `h3` by accident; the memberships region was the one copy that survived it.
 *
 * **In `components/shared/` on the same test its old folder used**: is it read by more than one
 * sibling? `overview/` and `memberships/` both read it, so it belongs where both can, which is one
 * level up. `overview/shared/` keeps `overview-messages.ts` on the identical test one level down —
 * the rule is the same at both levels, which is why the folders share a name.
 *
 * **Not an inventory addition, and the distinction is UX-89's own.** §11.5's `Panel` is the
 * component; this is one screen's composition of it with a heading, so it belongs beside the screen
 * rather than in `packages/ui`. It has no states, no variants and no props but its two slots — the
 * moment it grows a boolean, the split is wrong rather than the component being short of a flag.
 */
export function HomeRegion({
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
