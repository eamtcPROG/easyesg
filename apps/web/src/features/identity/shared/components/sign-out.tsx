'use client';

import { TextLink } from '@easyesg/ui';
import { useTransition } from 'react';
import { signOutAction } from '../actions/actions';

/**
 * **In `identity/shared/components/` because more than one journey reads it: `setup/` — its two steps and
 * `states/setup-unavailable.tsx` — and, since task 195, `acceptance/`'s form and its unavailable state.** Moved up
 * from `setup/components/shared/` when S-43 became its second reader. The way out of a screen an account is sent
 * to and cannot leave by navigating: S-36's (`design_spec.md` S-36's controls) — at rest on a step reached with a
 * session, and as the way on where the step's own is closed, a provider sign-in too old to prove a first password
 * or a setup that cannot be read (task 155) — and S-43's, which is what declining the terms comes to (task 195).
 *
 * **A button that leaves, never a link to S-01.** S-01 turns a reader who still holds a session away
 * (UX-136) — straight back to this screen, since the account is still in setup or still owes its acceptance —
 * so signing out is the only route to the sign-in a stale proof asks for. **The label is the caller's**: the same act reads
 * *sign out* at rest and *sign out and sign in again* where a fresh sign-in is the point.
 */
export function SignOut({ label }: { readonly label: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <TextLink asChild>
      <button
        type="button"
        aria-busy={pending}
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            await signOutAction();
          })
        }
      >
        {label}
      </button>
    </TextLink>
  );
}
