---
title: Pure Logic Leaves the Component and Gets a Spec
impact: MEDIUM-HIGH
impactDescription: every transition is a unit spec, not a browser journey
tags: pure, reducer, conversion, predicate, tools, domain, spec
---

## Pure Logic Leaves the Component and Gets a Spec

**Impact: MEDIUM-HIGH (every transition is a unit spec, not a browser journey)**

A reducer, a conversion between the form and the wire, a predicate, a selector — into `tools/` (web,
admin) or `domain/` (api), each with its spec beside it. A reducer is a function from state and
event to state, so its transitions are unit specs — including the ones a browser journey cannot
reach without contriving the timing. Inside a component none of it is reachable by any spec at all.

**If a form folder has no `tools/`, ask whether nothing is pure or whether nothing has been
extracted yet.** S-15's form had a form shape, two conversions and a reducer inside a 430-line
`'use client'` component; *having no `tools/`* was a fact about a moment, not a property of forms.

**Incorrect (the reducer and both conversions inside the component):**

```tsx
'use client';

export function OrganizationProfileForm({ organization }: Props) {
  const toFields = (o: Organization): ProfileFields => ({ name: o.name, countryCode: o.address.countryCode, /* … */ });
  const toPatch = (f: ProfileFields): OrganizationPatch => ({ /* … */ });
  const [state, dispatch] = useReducer((s: State, e: Event) => {
    switch (e.kind) { /* four cases, untested */ }
  }, organization, (o) => ({ report: null, record: o }));
  // 380 more lines
}
```

**Correct (pure modules with specs; the component composes and commits):**

```text
profile/
├─ components/form/organization-profile-form.tsx   187 lines: one `control`, one submit
└─ tools/
   ├─ profile-fields.ts        toFields · toPatch
   ├─ profile-fields.spec.ts
   ├─ profile-state.ts         PROFILE_EVENT · profileReducer · visibleNotice
   └─ profile-state.spec.ts
```

```tsx
import { toFields, toPatch } from '../../tools/profile-fields';
import { PROFILE_EVENT, initialProfileState, profileReducer, visibleNotice } from '../../tools/profile-state';

const [state, dispatch] = useReducer(profileReducer, organization, initialProfileState);
```

Writing the transitions out is what finds the stale field: two of the three live examples in this
repository were carrying one nobody had decided on, and both surfaced the moment the reducer had to
name the whole next state.
