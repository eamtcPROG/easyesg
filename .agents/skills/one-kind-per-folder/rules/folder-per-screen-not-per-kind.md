---
title: A Domain Serving Several Screens Splits per Screen, on a Verified Axis, Never by Kind
impact: CRITICAL
impactDescription: the folder keeps together the files that change together
tags: folder, per-screen, axis, kind, coupling
---

## A Domain Serving Several Screens Splits per Screen, on a Verified Axis, Never by Kind

**Impact: CRITICAL (the folder keeps together the files that change together)**

A feature folder that serves several screens splits per screen — one folder per `S-nn`, each holding
its own components, its own pure rules and its own wire half. **Verify the axis before cutting**: no
file may be reached by two screens, so the folders cannot introduce a coupling that was not already
there. Splitting by kind (`forms/`, `lists/`, `context/`) is the alternative and the wrong one — it
separates the files that change together, which is the only thing a folder can usefully keep.

**Incorrect (twenty-one component files from four screens in one folder; or grouped by kind):**

```text
organization/components/
├─ access-board.tsx          S-16
├─ access-filters.tsx        S-16
├─ create-organization-form.tsx   S-04
├─ filing-list.tsx           S-05
├─ organization-profile-form.tsx  S-15
└─ … sixteen more, nothing saying which belongs with which

organization/
├─ forms/      create-organization-form · organization-profile-form · invite-member
├─ lists/      access-list · filing-list · memberships-list
└─ context/    access-context
```

**Correct (one folder per screen, verified: no file served two):**

```text
organization/
├─ access/     S-16   actions/ · components/ · tools/
├─ creation/   S-04   actions/ · components/
├─ home/       S-05   components/ · tools/
├─ profile/    S-15   actions/ · components/ · tools/
└─ tools/      folder-shape.spec.ts
```

The same question — *does any file serve two of the groups?* — is asked again one level down, when
`components/` is cut per region (`components-mirror-the-return`).
