'use client';

import { useState } from 'react';

/**
 * Which outcome to show, and how to stop showing it — the other half of `ExpiringCallout`'s `onDismiss`.
 *
 * **Keyed on the outcome's identity, not its words.** Every submit produces a new outcome object — a Server Action's
 * result, a reducer's notice, a mutation's error — so the one a reader closed is recognised by being *that* object. A
 * refusal repeated word for word by the next attempt is a different object and shows again, which is the owner's
 * *"repeats on every submit"* (§8.1, 28 Sep 2026). A hidden flag would stay set through it, since nothing about the
 * element changes between two identical refusals.
 *
 * **Beside the outcome, never inside it.** Whatever holds the outcome — a `useReducer`, a `useState`, a
 * `useActionState` — is untouched, so a screen whose state already answers *is there a notice* needs no dismiss event
 * of its own. The object held here is a reference to one it already has, and it is compared, never read.
 *
 * `'use client'` because the barrel carries it into Server Components' graph, where Next refuses a module that imports
 * a state hook without the directive.
 */
export function useDismissible<T extends object>(outcome: T | null): readonly [T | null, () => void] {
  const [dismissed, setDismissed] = useState<T | null>(null);
  const shown = outcome !== null && outcome !== dismissed ? outcome : null;
  return [shown, () => setDismissed(outcome)] as const;
}
