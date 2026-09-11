---
title: Parallelism Comes From Composition, Not From Promise.all in the Shell
impact: CRITICAL
impactDescription: the split costs no latency and removes the coupling
tags: shell, parallel, rsc, promise-all, waterfall
---

## Parallelism Comes From Composition, Not From Promise.all in the Shell

**Impact: CRITICAL (the split costs no latency and removes the coupling)**

Sibling async Server Components start together in one render pass. A `Promise.all` in the shell
buys the same parallelism and adds coupling: the screen blocks on its slowest read before drawing
any of itself, and every region's data is threaded down as props — so a region that later needs one
more field has to be re-threaded from the top.

**Incorrect (one `Promise.all`, then props):**

```tsx
export default async function HomePage() {
  const [memberships, read] = await Promise.all([readMemberships(), readOrganizationPeriods()]);
  return (
    <>
      <OrganizationHeading memberships={memberships} />
      <OverviewSection read={read} membership={memberships?.find((m) => m.active)} />
      <MembershipsSection memberships={memberships} />
    </>
  );
}
```

**Correct (siblings, each awaiting its own read):**

```tsx
export async function OverviewSection() {
  const [read, membership] = await Promise.all([readOrganizationPeriods(), readActiveMembership()]);
  // …
}

export async function MembershipsSection() {
  const memberships = await readMemberships();
  // …
}
```

Two regions reading the same collection is one HTTP call when the read is wrapped in React
`cache()` — `readActiveMembership()` and `readMemberships()` share one promise per request — so
"each region reads for itself" duplicates nothing. What the split removes is the *coupling*, not the
parallelism. `server-parallel-fetching` in `vercel-react-best-practices` is the same rule seen from
the performance side; this one is about who owns the read.

A `Promise.all` **inside** a section, over that section's own independent awaits, is correct and
expected (`async-parallel`).
