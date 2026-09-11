import { Skeleton, SKELETON_SHAPE } from '@easyesg/ui';
import styles from '../styles/home.module.css';

/**
 * `OrganizationHeading`'s §8.1 `loading — initial`.
 *
 * **The heights are the heading's, not a guess**, which is the whole of UX-115's *"skeleton matching
 * final layout; no layout shift on resolve"*: the `h1` bar takes the heading shape and the role bar
 * the text one, so what resolves into them changes the words and not the box. The widths are this
 * screen's — an organization's name and a role are both variable, so the bars are sized for a
 * typical one rather than for the longest.
 *
 * **Whether it is ever seen is a separate question from whether it is correct**, and the answer
 * today is no: `readActiveMembership` is React-`cache()`d and `GlobalTier` awaits the same promise
 * **outside** any boundary in the `(app)` layout, so the shell cannot flush before this region's
 * content is ready and React inlines it rather than emitting a fallback. Measured, not assumed —
 * `e2e/web/home.spec.ts` asserts the served HTML carries no skeleton here while it does carry the
 * overview's. It exists so the state is defined (UX-90) and so the day the global tier gains a
 * boundary of its own, this screen already behaves.
 *
 * **What the suite actually asserts is the positive form, not this fallback's absence** (task 126,
 * correcting a sentence above that claimed otherwise). `e2e/web/home.spec.ts` counts React's
 * pending-boundary markers in the shell and requires exactly **one** — the overview's — and finds
 * this region's `hgroup` inlined ahead of it. Nothing looks for the skeleton's absence, and a
 * class-name marker could not: the stylesheet carries every class whether or not the element
 * rendered, which is the trap that file records twice.
 */
export function HeadingLoading() {
  return (
    <div>
      <Skeleton shape={SKELETON_SHAPE.HEADING} className={styles.loadingTitle} />
      <Skeleton className={styles.loadingRole} />
    </div>
  );
}
