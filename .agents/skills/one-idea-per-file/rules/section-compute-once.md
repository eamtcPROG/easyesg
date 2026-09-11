---
title: A Value That Must Agree Across Parts Is Computed Once, in the Section
impact: HIGH
impactDescription: no two parts can disagree on one request
tags: section, clock, now, selectors, consistency
---

## A Value That Must Agree Across Parts Is Computed Once, in the Section

**Impact: HIGH (no two parts can disagree on one request)**

The clock is the case. Two regions ask whether a deadline has passed; a region that parses the read
itself owns a `new Date()` of its own, and one can call a filing overdue while another does not, on a
request that happens to straddle midnight in the period's zone. The section is where the time
enters, exactly once; every selector below it is a pure function over rows that are already dated —
which is what makes moving those selectors into the regions safe.

**Incorrect (each region asks the time):**

```tsx
export function AttentionRegion({ periods }: { periods: Period[] }) {
  const now = new Date();
  const overdue = periods.filter((p) => p.dueAt < now);
  // …
}

export function EverythingRegion({ periods }: { periods: Period[] }) {
  const now = new Date(); // a second clock
  // …
}
```

**Correct (dated once, selected purely):**

```tsx
// section
const rows = toOverviewRows({ periods: read.periods, now: new Date() });

// regions — pure over rows that already carry `overdue`
export function AttentionRegion({ rows }: { rows: readonly OverviewRow[] }) {
  const overdue = attentionRows(rows);
  // …
}
```

`toOverviewRows` and `attentionRows` are in `tools/` with specs; the regions have nothing left to
test but markup.
