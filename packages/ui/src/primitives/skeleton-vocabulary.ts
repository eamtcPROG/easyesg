/**
 * The shapes a skeleton bar takes, from `EasyESG Components.dc.html`'s specimen — values extracted,
 * markup never copied (OQ-10).
 *
 * **A directive-free sibling module even though `skeleton.tsx` carries no `'use client'`**, which is
 * this package's standing shape for a vocabulary: the four that lived inside client modules reached
 * Server Components as `undefined` and rendered the wrong colours with every gate green. Keeping the
 * rule unconditional is what stops the next component's directive turning a working import into a
 * silent one.
 */
export const SKELETON_SHAPE = {
  /** A line of body or caption text — the specimen's 12 px bar. */
  TEXT: 'text',
  /** A heading's line: taller, and the one drawn in the stronger of the two greys. */
  HEADING: 'heading',
  /** A row, chip or control — anything with a height of its own. The specimen's 40 px block. */
  BLOCK: 'block',
} as const;

export type SkeletonShape = (typeof SKELETON_SHAPE)[keyof typeof SKELETON_SHAPE];
