import { Button, Callout, CALLOUT_INTENT, TextLink } from '@easyesg/ui';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { signOutAction } from '../actions/actions';
import type { HeldAccount } from '../tools/held-account';
import styles from '../styles/identity-screens.module.css';

/**
 * S-02's success when a different account is signed in in this browser (task 160; `design_spec.md` S-02) —
 * **switch, or stay**, the project owner's answer.
 *
 * The screen did what was asked, so the callout is a success; what it cannot do is send the reader to sign
 * in, because UX-136's gate would turn them to the signed-in account's home. So the primary action signs out
 * first and opens sign-in, carrying a pending invitation's way back where there is one — S-03's
 * wrong-account control, the nearest precedent — and the line beneath continues as the current account,
 * since a Focus screen has no navigation to leave by otherwise.
 *
 * **In `shared/components/` on one test — read by more than one journey: `verify/` and `reset/`.** The
 * sentence and the button's words are the caller's, because S-02 knows the confirmed address on one path
 * and not on the other; the way to stay is the same on both and is this file's.
 *
 * **The button is a form's**, as S-03's is: `signOutAction` redirects, and a form keeps that working before
 * hydration.
 */
export function SignedInElsewhere({
  heldAccount,
  title,
  body,
  switchLabel,
  returnTo,
}: {
  readonly heldAccount: HeldAccount;
  readonly title: string;
  readonly body: string;
  readonly switchLabel: string;
  /** Where signing in leads afterwards — S-03's invitation, when the confirmation began there. */
  readonly returnTo?: string;
}) {
  const t = useTranslations('identity.signedInElsewhere');

  return (
    <div className={styles.stack}>
      <Callout
        intent={CALLOUT_INTENT.SUCCESS}
        title={title}
        action={
          <form action={signOutAction.bind(null, returnTo)}>
            <Button type="submit">{switchLabel}</Button>
          </form>
        }
      >
        {body}
      </Callout>
      <p className={`t-body-sm ${styles.altAction}`}>
        <TextLink asChild>
          <Link href={heldAccount.home}>{t('continueAs', { current: heldAccount.email })}</Link>
        </TextLink>
      </p>
    </div>
  );
}
