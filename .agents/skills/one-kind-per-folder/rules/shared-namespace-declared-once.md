---
title: A Message Namespace Is One Exported Constant in the shared/ Its Readers Surround, Extracted by the Split
impact: MEDIUM-HIGH
impactDescription: a split multiplies no literal, and a part cannot reach a sibling's copy
tags: shared, namespace, messages, i18n, constant, split
---

## A Message Namespace Is One Exported Constant in the `shared/` Its Readers Surround, Extracted by the Split

**Impact: MEDIUM-HIGH (a split multiplies no literal, and a part cannot reach a sibling's copy)**

A namespace is one value several files must spell identically — a plain exported constant, not a
member of some larger object (it is not a closed vocabulary with alternatives to choose between).
It lives in the `shared/` of the folder whose files read it, **not in `tools/`**: a catalogue key is
a presentation concern the components own.

**Extract it in the same change as the split, not after.** A section that spelled its namespace
twice, split into five files, has written the literal five times — and each new file reaches its
keys through a prefix that lets it read a sibling region's copy by accident. Narrow the namespace to
the region at the same time, so the keys lose their prefix.

**Incorrect (the literal repeated by the split, keys reached through a prefix):**

```tsx
// memberships-section.tsx
const t = await getTranslations('organization.home');
t('memberships.heading');

// membership-row.tsx
const t = await getTranslations('organization.home');
t('memberships.active');            // could as easily reach 'overview.empty.body'
```

**Correct (declared once, narrowed, keys bare):**

```ts
// memberships/shared/memberships-messages.ts
export const MEMBERSHIPS_MESSAGES = 'organization.home.memberships';
```

```tsx
// membership-row.tsx
const t = await getTranslations(MEMBERSHIPS_MESSAGES);
t('active');
```

A namespace two screens share (`organization.access.roles`, read by S-05's row and S-16's list) is a
bigger decision than one region's split — it stays a literal at each site until someone decides the
feature-level home, and the docblock says so.
