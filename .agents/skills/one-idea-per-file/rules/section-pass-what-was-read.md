---
title: Pass What Was Read — the Object, Never Three Strings or a Boolean Projection
impact: HIGH
impactDescription: a part that needs one more field is not re-threaded from the section
tags: section, props, projection, boolean, adjacent-parameters
---

## Pass What Was Read — the Object, Never Three Strings or a Boolean Projection

**Impact: HIGH (a part that needs one more field is not re-threaded from the section)**

A part receives the whole thing that was read and derives what it needs from it. A boolean is a
lossy projection of the object: the region that later needs the role it holds or the organization
it names has to be re-threaded from the section, through every level between. Three positional
strings are also three adjacent same-typed parameters, where a swapped call compiles and renders a
plausible wrong answer.

**Incorrect (a projection, and a row taking three strings):**

```tsx
<EverythingRegion rows={rows} canWrite={membership !== null && membership.role !== 'viewer'} />

<MembershipRow name={m.organizationName} role={m.role} active={m.active} />
```

**Correct (the object, and one predicate where the rule lives):**

```tsx
<EverythingRegion rows={rows} membership={membership} />

// inside the region
const writable = mayWrite(membership);

<MembershipRow membership={m} />
```

Three call sites of `mayWrite` are three uses of **one** predicate, not three spellings of a rule —
the drift this prevents was two *different* expressions of it, `role !== VIEWER && membership !==
null` on one screen against the opposite conjunct order on another.
