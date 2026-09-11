---
title: A Structural Claim Is Measured, Not Reasoned
impact: MEDIUM
impactDescription: a claim that can be false has an assertion that fails when it is
tags: reason, measurement, assertion, by-construction, streaming, explain
---

## A Structural Claim Is Measured, Not Reasoned

**Impact: MEDIUM (a claim that can be false has an assertion that fails when it is)**

Whether a boundary streams is read off the served HTML — React writes `<!--$?-->` per boundary
still pending when the shell flushes. Whether a directory mixes files with folders is a spec that
walks it. Whether an index is used is an `EXPLAIN` (with `enable_seqscan = off` at these table
sizes). *By construction* is the phrase to be suspicious of: it is what a docblock says when the
author has reasoned instead of looked, and it is exactly where a split changed the thing it claimed
was unchanged.

An assertion is not a measurement until it has been **proven to bite** — break the thing once and
watch it go red. Two position checks in one suite were unconditionally true on their subjects: one
located the organization's name and called it the heading, but the name's first occurrence was the
global bar's plate two thousand bytes earlier; the other compared two positions that held the same
order whichever way the region rendered.

**Incorrect (a comment carries the claim):**

```tsx
// The membership region renders inline: its read is already awaited by the layout, so the
// boundary count is unchanged by construction.
```

**Correct (an assertion carries it, with a marker that belongs to the subject and to nothing else):**

```ts
it('streams exactly one region, and the heading is inlined', async () => {
  const html = await servedHtml('/home');
  expect(occurrences(html, '<!--$?-->')).toBe(1);
  expect(occurrences(html, '<hgroup')).toBe(1);            // the marker cannot quietly gain a second source
  expect(html.indexOf('<hgroup')).toBeLessThan(html.indexOf('role="status"'));
});
```

Proven to bite by making the heading suspend (`1` → `2`) and by moving the `hgroup` behind a real
read (position 5,532 → 86,967), then restored.
