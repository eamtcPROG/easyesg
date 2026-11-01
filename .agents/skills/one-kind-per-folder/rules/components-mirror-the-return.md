---
title: The Top Level of components/ Is What the Route Renders
impact: HIGH
impactDescription: the folder listing and the JSX say the same thing in the same order
tags: components, return, render-order, leaves, styles, shared
---

## The Top Level of `components/` Is What the Route Renders

**Impact: HIGH (the folder listing and the JSX say the same thing in the same order)**

One folder per child of the shell's `return`, in render order — plus a leaf for each thing that
belongs to none of them (`styles/`, `shared/`). A listing is never *shorter* than the `return`,
which is the property worth having: a reader who knows the screen can predict the tree, and a
reader who knows the tree can predict the screen. It is the per-screen partition applied one level
down and verified the same way — *does any file serve two of the groups?*

**Incorrect (the `return` has four children; the folder has sixteen files):**

```tsx
return (
  <div className={styles.screen}>
    <ArrivalNotice searchParams={searchParams} />
    <Suspense fallback={<HeadingLoading />}><OrganizationHeading /></Suspense>
    <Suspense fallback={<OverviewLoading />}><OverviewSection /></Suspense>
    <Suspense fallback={<MembershipsLoading />}><MembershipsSection /></Suspense>
  </div>
);
```

```text
components/
├─ arrival-notice.tsx
├─ attention-region.tsx
├─ everything-region.tsx
├─ filing-list.tsx
├─ heading-loading.tsx
├─ home.module.css
├─ memberships-loading.tsx
├─ memberships-section.tsx
└─ … eight more
```

**Correct (four folders named for the four children, in their order, plus two leaves):**

```text
components/
├─ arrival/       arrival-notice
├─ heading/       organization-heading · heading-loading
├─ overview/      section/ · regions/ · states/ · shared/
├─ memberships/   section/ · list/ · states/ · shared/
├─ shared/        home-region            ← read by two regions
└─ styles/        home.module.css        ← read by four
```

The route's imports are grouped by region rather than alphabetically, with a comment saying so, so
that each fallback sits beside the thing it stands in for and the import block reads as the same
list.
