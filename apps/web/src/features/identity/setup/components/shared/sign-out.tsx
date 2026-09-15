'use client';

import { TextLink } from '@easyesg/ui';
import { useTransition } from 'react';
import { signOutAction } from '../../../shared/actions/actions';

/**
 * **In `setup/components/shared/` because more than one sibling reads it: `steps/session-password-step.tsx`,
 * `steps/profile-step.tsx` and `states/setup-unavailable.tsx`.** S-36's way out (`design_spec.md` S-36's
 * controls): at rest on a step reached with a session, and as the way on where the step's own is closed
 * — a provider sign-in too old to prove a first password, or a setup that cannot be read (task 155).
 *
 * **A button that leaves, never a link to S-01.** S-01 turns a reader who still holds a session away
 * (UX-136) — straight back to this screen, since the account is still in setup — so signing out is the
 * only route to the sign-in a stale proof asks for. **The label is the caller's**: the same act reads
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
