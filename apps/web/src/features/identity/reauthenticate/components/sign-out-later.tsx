'use client';

import { BUTTON_VARIANT, Button } from '@easyesg/ui';
import { useTranslations } from 'next-intl';
import { useTransition } from 'react';
import { signOutHere } from '@/client/session/sign-out';
import { useRouter } from '@/i18n/navigation';
import { ROUTES, withQuery } from '@/lib/routes';
import styles from './reauthentication.module.css';

/**
 * The artboard's second way out: *sign out and finish later* (task 92).
 *
 * **It ends what this browser holds through the session tier, then goes to S-01 with the screen as its
 * return path** — so signing in later lands back on the screen, and for S-07 that is task 35.3's journey,
 * where the durable queue drains on the step. What is unsent stays on this device under the account's
 * key; the caller's explanation says so, and says too where this browser cannot keep it.
 *
 * **Not `signOutAction`**, for the reason `handlers/end-session.ts` gives: a Server Action posts to the
 * page's own address, which the proxy gates, and this dialogue exists only because no session is held.
 * The navigation is the client router's, so nothing unloads and no unload guard asks anything on the way.
 *
 * **UX-37's warning before a sign-out that abandons a queue is task 93's**, on the account corner. Here the
 * dialogue's own sentence is that warning, and the reader chose this over continuing.
 */
export function SignOutLater({ returnTo }: { readonly returnTo: string }) {
  const t = useTranslations('identity.reauthenticate');
  const router = useRouter();
  const [leaving, startLeaving] = useTransition();

  const leave = () =>
    startLeaving(async () => {
      await signOutHere();
      router.push(withQuery(ROUTES.SIGN_IN, `return=${encodeURIComponent(returnTo)}`));
    });

  return (
    <div className={styles.actions}>
      <Button type="button" variant={BUTTON_VARIANT.SUBTLE} busy={leaving} className={styles.action} onClick={leave}>
        {t('signOut')}
      </Button>
    </div>
  );
}
