---
title: How Many Siblings Read It Decides Where a File Goes, and It Moves Up When a New Reader Appears
impact: MEDIUM-HIGH
impactDescription: every file sits at the lowest level from which all its readers can see it
tags: shared, siblings, readers, move-up, leaf
---

## How Many Siblings Read It Decides Where a File Goes, and It Moves Up When a New Reader Appears

**Impact: MEDIUM-HIGH (every file sits at the lowest level from which all its readers can see it)**

Below the top level of `components/`, one question decides placement: **how many siblings read this
file?** One, and it lives with that sibling. More than one, and it gets its own leaf — `shared/` —
at the level where all its readers can see it. The same question is asked at every level, which is
why a `shared/` at two levels carries the same name: it is the same rule asked about different
siblings.

And the answer changes. A file **moves up when a new reader appears**, and the move is the moment
to ask whether its name still describes it.

**The worked example, moved twice:**

```text
1. Four copies of `<Panel><h2 className="t-heading-3 …">` inside four overview files.
2. overview/shared/overview-region.tsx      — three regions and an empty state read it
3. components/shared/home-region.tsx        — the membership split found the fifth copy,
                                              one level up; it lost `Overview` from its name
                                              because a region's heading level follows from
                                              the screen having one h1 and was never the
                                              overview's business
```

**Incorrect (a file read by two regions kept inside one of them):**

```text
overview/shared/overview-region.tsx     ← imported by memberships/section/memberships-section.tsx
```

**Correct (at the level both readers can see):**

```text
components/shared/home-region.tsx
```

The counter-case matters as much: a file with one reader that sits in `shared/` is a finding — it
was put there for being hard to place, which is how a `shared/` becomes a junk drawer
(`shared-admission-test`).
