import { SKELETON_SHAPE, type SkeletonShape } from './skeleton-vocabulary';
import styles from './skeleton.module.css';

/**
 * Skeleton — §11.5's Primitives row, built 11 Sep 2026 (task 115).
 *
 * **An inventory entry that was enumerated and never built**, not an addition: §11.5 has listed
 * *"Skeleton · Spinner · Progress"* since the inventory was written, `Spinner`'s own docblock has
 * pointed at it since task 20 — *"skeletons cover everything whose final layout is known"* — and
 * `EasyESG Components.dc.html` renders the specimen with its token named (`skeleton.bg`). So UX-89's
 * second step is already discharged and this is the first instance catching up with the review.
 *
 * **It has no §8.1 states of its own, because it *is* one.** §11.5 requires every applicable state
 * from the model and the applicable set here is empty — a skeleton cannot be empty, erroring,
 * read-only or pending; it is the `loading — initial` affordance those states resolve into. Stated
 * rather than left for a reader to wonder about, which is what `ChromeDrawer`'s row does for its own
 * short set.
 *
 * **Decorative, and never the thing that announces the wait.** Each bar is `aria-hidden`, exactly as
 * `Spinner` is: the *container* names what is loading, so a screen reader hears one sentence rather
 * than counting grey rectangles (UX-102 — colour, and shape, are never the sole carrier).
 *
 * **Width is the caller's and height is the shape's.** A bar fills its container inline, so layout
 * lives in the consumer's own stylesheet where the layout it is matching already lives — which is
 * what lets a skeleton *match the final layout* (UX-115) without this package knowing any screen's
 * measurements, and what keeps it from growing a `width` prop per caller.
 */
export interface SkeletonProps {
  readonly shape?: SkeletonShape;
  /** The caller's own width and spacing — the half of "matching the final layout" it owns. */
  readonly className?: string;
}

export function Skeleton({ shape = SKELETON_SHAPE.TEXT, className }: SkeletonProps) {
  const classes = [styles.bar, styles[shape], className].filter(Boolean).join(' ');

  return <span aria-hidden="true" className={classes} />;
}
