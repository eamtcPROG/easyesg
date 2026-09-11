---
title: index.ts Barrels and Empty Scaffold Folders Go When the Domain Is Built
impact: HIGH
impactDescription: no file describes a shape that is no longer there
tags: folder, barrel, index, scaffold, gitkeep
---

## `index.ts` Barrels and Empty Scaffold Folders Go When the Domain Is Built

**Impact: HIGH (no file describes a shape that is no longer there)**

A barrel that exports nothing and a folder holding only `.gitkeep` are scaffolding. A scaffold that
outlives the scaffolding lies to the next reader: `organization/index.ts` still read *"Not built.
Folders are `components/ hooks/ schema/ queries/ types/`"* over a feature serving four screens,
false on both counts. Delete them when the first real file lands, and move the docblock's FR range —
often the only place the feature's ownership is written down — to that file.

And add no barrel in their place: an `index.ts` re-exporting the kinds is the shape
`bundle-barrel-imports` refuses, and a reader of `access-list.tsx` learns nothing from
`import { AccessList } from '..'` that the direct path did not say better.

**Incorrect (a built feature keeping its scaffold):**

```text
organization/
├─ index.ts            export {};  // "Not built. Folders are …"
├─ hooks/.gitkeep
├─ queries/.gitkeep
├─ schema/.gitkeep
├─ access/
└─ home/
```

**Correct (the scaffold gone; the kinds are the ones the screens have):**

```text
organization/
├─ access/
├─ creation/
├─ home/
├─ profile/
└─ tools/
```

The **unbuilt** scaffolds — an `index.ts` reading *"Not built"* beside five `.gitkeep` folders — are
the same shape and go the same way, when each domain is built. Until then they are the recorded
backlog, not an exemption.
