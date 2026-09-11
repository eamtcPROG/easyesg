---
title: A Directory Holds Files or Folders, Never Both
impact: CRITICAL
impactDescription: a listing says what kind of thing every entry is without opening it
tags: folder, files, listing, exemptions, framework
---

## A Directory Holds Files or Folders, Never Both

**Impact: CRITICAL (a listing says what kind of thing every entry is without opening it)**

A listing that mixes the two makes a reader check every entry to learn what kind of thing it is.
Holds in **every directory under `src/`** of `apps/web` and `apps/admin` — not only feature folders.

Two exemptions, both because a framework decides the layout there:

- **Its route tree.** Next's `app/` (a `page.tsx` beside `users/`), and `proxy.ts` at `src/`;
  TanStack's `routes/` — a pathless layout *is* `_realm.tsx` beside `_realm/` by the router's own
  convention — and its generated `route-tree.gen.ts`.
- **The one file that defines a directory as a unit the framework composes** — a `page.tsx`, a
  route file — and nothing else: not a stylesheet, not a spec, not a barrel. In these two apps every
  instance of this sits inside the first exemption, so in practice there is one.

**Incorrect (a stylesheet and six overview files beside the region folders):**

```text
home/components/
├─ arrival/
├─ heading/
├─ memberships/
├─ attention-region.tsx
├─ everything-region.tsx
├─ filing-list.tsx
├─ overview-empty.tsx
├─ overview-section.tsx
├─ resume-region.tsx
└─ home.module.css
```

**Correct (every entry a folder; what belongs to no region gets its own leaf):**

```text
home/components/
├─ arrival/
├─ heading/
├─ overview/      section/ · regions/ · states/ · shared/
├─ memberships/   section/ · list/ · states/ · shared/
├─ shared/        home-region.tsx
└─ styles/        home.module.css
```

The stylesheet is read by four regions, so it belongs to none of them — and under this rule it cannot
sit above them either: `styles/` is a fifth leaf. A spec with no subject module (one that walks the
tree) lives in a `tools/` of its own, because a file at the feature's root would fail the rule it
asserts.
