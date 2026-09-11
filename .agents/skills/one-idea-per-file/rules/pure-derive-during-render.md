---
title: Derive During Render; Never Store and Clear by an Effect
impact: MEDIUM-HIGH
impactDescription: one place that can be wrong instead of two that can disagree
tags: pure, derived-state, effect, render, notice
---

## Derive During Render; Never Store and Clear by an Effect

**Impact: MEDIUM-HIGH (one place that can be wrong instead of two that can disagree)**

A value that is a function of the state and something the render already knows is computed in the
render, by a pure function with a spec. Storing it and clearing it in an effect adds a second place
that can fall out of step with the first — an event on every keystroke, a subscription, and a
dependency list that has to be kept honest by hand.

**Incorrect (an effect clearing a stored notice when the form becomes dirty):**

```tsx
const [notice, setNotice] = useState<Notice | null>(null);

useEffect(() => {
  if (formState.isDirty && notice?.intent === CALLOUT_INTENT.SUCCESS) {
    setNotice(null);
  }
}, [formState.isDirty, notice]);
```

**Correct (derived, and the asymmetry stated in one expression):**

```ts
// tools/profile-state.ts
export const visibleNotice = (state: ProfileState, dirty: boolean): Notice | null => {
  if (state.report === null) return null;
  if (state.report.kind === PROFILE_REPORT.SAVED && dirty) return null; // a success is true only while nothing differs
  return state.report.notice;                                             // a refusal stands until the next attempt
};
```

```tsx
<ProfileNotice notice={visibleNotice(state, formState.isDirty)} />
```

The consequence is worth stating rather than hiding: the success notice comes back if the reader
undoes every edit, because the sentence it carries — *the record on screen is what was saved* — is
true again. `rerender-derived-state-no-effect` in `vercel-react-best-practices` is the same rule from
the render-count side.
