---
title: A Region With Parts Splits Into section/, Its Parts, states/ and shared/
impact: HIGH
impactDescription: the read, the parts, the arms and the shared values each have one place
tags: components, region, section, list, states, shared, fallback
---

## A Region With Parts Splits Into `section/`, Its Parts, `states/` and `shared/`

**Impact: HIGH (the read, the parts, the arms and the shared values each have one place)**

When a region is more than one file, it is the same four questions every time:

- **`section/`** — what the route renders: the section itself (the read and the arm decision) and
  the fallback it is paired with. The loading state sits here rather than in `states/` because it is
  not an arm the section *returns* — it is the boundary's fallback, and the route is what hands it
  over.
- **The parts** — `list/` (the list and its row) or `regions/` (the questions the region answers),
  each taking what was read.
- **`states/`** — the arms that *replace* the parts: unreachable, empty, permission.
- **`shared/`** — what more than one of those reads: the namespace constant, a row idiom two parts
  draw.

**Incorrect (the parts and the arms as flat siblings, the fallback among the arms):**

```text
overview/
├─ overview-section.tsx
├─ overview-loading.tsx
├─ overview-empty.tsx
├─ overview-unavailable.tsx
├─ attention-region.tsx
├─ resume-region.tsx
├─ everything-region.tsx
├─ filing-list.tsx
└─ overview-messages.ts
```

**Correct (two regions of one screen, the same anatomy):**

```text
overview/
├─ section/    overview-section · overview-loading
├─ regions/    attention-region · resume-region · everything-region · filing-list
├─ states/     overview-empty · overview-unavailable
└─ shared/     overview-messages

memberships/
├─ section/    memberships-section · memberships-loading · memberships-switch-note
├─ list/       memberships-list · membership-row
├─ states/     memberships-unreachable
└─ shared/     memberships-messages
```

`filing-list.tsx` is under `regions/` because two regions draw it and no state does; the switch note
is under `section/` because it renders outside the arm — a reader whose list failed still needs to
be told where the acting happens.
