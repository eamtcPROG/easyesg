'use client';

import { Button, type ButtonVariant } from '@easyesg/ui';
import type { ReactNode } from 'react';
import { useHydrated } from '@/client/hydration/use-hydrated';

/**
 * A credential form's submit, **disabled until the page has hydrated** (task 153; §12.5.6's task-153 row, NFR-81).
 *
 * The form's handler exists only once React has hydrated, while its markup is interactive before that. Task 96's
 * `method="post"` kept a submit that beat hydration from putting a credential in the URL and left it answering a
 * 405; this closes the rest. A form whose default button is disabled is not submitted by Enter, so a press before
 * hydration sends nothing at all. With scripting off it stays disabled, and `ScriptingRequired` beside it says why.
 *
 * **In `src/shared/` because two features read it** — identity's pre-session forms and S-28's row forms.
 */
export function CredentialSubmit({
  busy,
  variant,
  children,
}: {
  readonly busy: boolean;
  /** The button's look, for a confirmation that removes something (S-28's *Turn off*, *Unlink*); primary otherwise. */
  readonly variant?: ButtonVariant;
  readonly children: ReactNode;
}) {
  const hydrated = useHydrated();
  return (
    <Button type="submit" variant={variant} busy={busy} disabled={!hydrated}>
      {children}
    </Button>
  );
}
