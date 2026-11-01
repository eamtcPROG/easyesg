---
title: Every Region That Reads Gets a Boundary and a Skeleton, and Whether It Streams Is Measured
impact: HIGH
impactDescription: the loading state exists by rule; the streaming claim exists by measurement
tags: shell, suspense, streaming, skeleton, loading-state, rsc
---

## Every Region That Reads Gets a Boundary and a Skeleton, and Whether It Streams Is Measured

**Impact: HIGH (the loading state exists by rule; the streaming claim exists by measurement)**

React Server Components only. A region that reads over the wire is wrapped in a `Suspense` with a
designed fallback — its `loading` state, which the design spec requires whether or not this
composition ever lets it be seen (UX-90: an undefined state is a defect, not an omission).

Two things about the fallback and the boundary are commonly got wrong:

- **A fallback may await; it may not do I/O.** A fallback that suspends resolves against the
  *parent* boundary, so the shell waits for it. Awaiting a message catalogue the request has already
  resolved is a microtask; awaiting anything over the wire blocks the shell on exactly the thing the
  boundary was added to stream past — and nothing tells you, because the boundary still looks like
  it is working.
- **Whether a boundary streams is a fact about the composition, not the boundary.** A read the layout
  already awaits outside any boundary is resolved before the shell can flush, so React inlines the
  region and its skeleton never appears. That boundary is not a defect; a boundary *claiming* to buy
  something is.

**Incorrect (a fallback that reads over the wire; a docblock that asserts streaming):**

```tsx
/** This is the screen's one streaming boundary. */
export async function OverviewLoading() {
  const membership = await readActiveMembership(); // I/O in a fallback
  return <Skeleton rows={membership ? 3 : 1} />;
}
```

**Correct (the fallback resolves a catalogue; a served-HTML assertion carries the claim):**

```tsx
export async function OverviewLoading() {
  const t = await getTranslations(OVERVIEW_MESSAGES); // already read for the page: a microtask
  return <Skeleton label={t('loading')} />;
}
```

```ts
// e2e/web/home.spec.ts — React writes `<!--$?-->` per boundary still pending when the shell flushes.
expect(occurrences(html, '<!--$?-->')).toBe(1);
```

Assert on the fallback's **markup** (`role="status"`), never on its label: next-intl ships the whole
catalogue in the payload, so the sentence is in the HTML whether the boundary streams or not. The
count above is the claim "exactly one region streams", and it was proven to bite by making a second
region suspend, which took it to 2.
