---
title: Every File Carries Its Reason, and States No Count of Anything Outside Itself
impact: MEDIUM
impactDescription: the next reader learns why, and no docblock outlives a fact it cannot see
tags: reason, docblock, placement, counts, drift
---

## Every File Carries Its Reason, and States No Count of Anything Outside Itself

**Impact: MEDIUM (the next reader learns why, and no docblock outlives a fact it cannot see)**

The docblock says what this file does that nothing below it can, why it is in this folder, and
which test put it there — the admission test for a `shared/`, the sibling count for a `tools/`. It
restates nothing the code already says.

And it states **no count of anything outside its own file**. Two docblocks in the refactor this rule
comes from did, and both were wrong within a commit: one said *"the screen's one Suspense
boundary"* the day before two more boundaries were added; one said a pending-boundary count was
*"unchanged by construction rather than by measurement"*, and it had changed in exactly the place
the sentence flagged — and stayed wrong through three tasks that waived the browser suite. A count
belongs in the spec that measures it.

**Incorrect (restating the code, then asserting a count about siblings):**

```tsx
/**
 * Renders the memberships section. Uses HomeRegion and maps memberships to rows.
 * This is the screen's one Suspense boundary that streams.
 */
export async function MembershipsSection() { … }
```

**Correct (what only this file does, why it is here, what would move it):**

```tsx
/**
 * UC-16's *view memberships* half (FR-12).
 *
 * **The section reads; the parts render.** This file does the two things no part can: make the
 * read, and decide which of §8.1's arms the region is in. Everything below it takes what was read.
 *
 * **It reads for itself rather than taking the list as a prop**: `readMemberships()` is
 * React-`cache()`d, so the heading, the global tier and this region share one HTTP call.
 *
 * **Whether this boundary streams is `e2e/web/home.spec.ts`'s claim, not this file's** — it counts
 * pending boundaries in the served HTML, and this region gaining a real wait turns it red.
 */
export async function MembershipsSection() { … }
```
