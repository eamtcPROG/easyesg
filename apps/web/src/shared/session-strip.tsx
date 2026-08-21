import { Button } from '@easyesg/ui';
import { getTranslations } from 'next-intl/server';
import { signOutAction } from '@/features/identity/actions';
import { readSession } from '@/server/session';
import styles from './session-strip.module.css';

/**
 * The interim signed-in strip — the account email and sign-out, and nothing else.
 *
 * **Interim by decision, not neglect** (task 22's open-question batch): the deliverable is
 * browser sign-in *and* sign-out, and §4.2's real global tier — organization switcher,
 * notification centre, user menu — lands with the first workspace screens. Task 30's row in
 * `docs/task.md` owns replacing this. Composition of inventory pieces only (UX-89): a `Button`
 * inside a plain form posting the sign-out Server Action, in `src/shared/` because it is
 * chrome owned by no feature, like `SiteFooter`.
 *
 * A Server Component: the session is read server-side (AD-9 — no token or session detail may
 * reach browser JavaScript; the email shown is the "signed in as" line the session response
 * carries for exactly this, task 21's DTO note). `proxy.ts` guarantees a cookie above this
 * point but not a READABLE one — an unsealable cookie renders nothing here, and the first data
 * call's 401 is what surfaces it.
 */
export async function SessionStrip() {
  const session = await readSession();
  if (!session) return null;

  const t = await getTranslations('chrome');

  return (
    <header className={styles.strip}>
      <span className={styles.account}>
        {t('signedInAs')} <strong>{session.account.email}</strong>
      </span>
      <form action={signOutAction}>
        <Button type="submit" variant="subtle">
          {t('signOut')}
        </Button>
      </form>
    </header>
  );
}
