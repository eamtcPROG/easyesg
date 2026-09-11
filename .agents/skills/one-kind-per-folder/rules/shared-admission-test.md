---
title: Every shared/ Carries Its Admission Test in a Docblock
impact: MEDIUM-HIGH
impactDescription: a folder named for sharing does not become a junk drawer
tags: shared, docblock, admission, junk-drawer, inventory
---

## Every `shared/` Carries Its Admission Test in a Docblock

**Impact: MEDIUM-HIGH (a folder named for sharing does not become a junk drawer)**

Each file in a `shared/` states, in its docblock, the test that admitted it: *read by more than one
sibling at this level* — and names them. A folder named for sharing becomes a junk drawer the first
time something is put there for being hard to place, and the docblock is what makes that visible in
review: a file whose stated readers are one is a finding.

The other half of the test is what a `shared/` file is **not**. A composition of an inventory
component for one screen — a `Panel` and the `h2` that names a region — is that screen's `shared/`,
not an addition to `packages/ui`: it has no states, no variants and no props but its slots. The
moment it grows a boolean, the split is wrong rather than the component being short of a flag
(UX-89).

**Incorrect (in `shared/` with no stated reason, one reader):**

```tsx
/** Shared region wrapper. */
export function HomeRegion({ heading, children }: Props) { … }
```

**Correct (the test, its readers, and the boundary with the inventory):**

```tsx
/**
 * The anatomy every region of S-05 shares: a `Panel` and the `h2` that names it.
 *
 * **In `components/shared/` on one test: is it read by more than one sibling?** `overview/` and
 * `memberships/` both read it, so it belongs where both can, which is one level up. `overview/shared/`
 * keeps `overview-messages.ts` on the identical test one level down.
 *
 * **Not an inventory addition.** §11.5's `Panel` is the component; this is one screen's composition
 * of it with a heading. It has no states, no variants and no props but its two slots — the moment it
 * grows a boolean, the split is wrong.
 */
export function HomeRegion({ heading, children }: Props) { … }
```
