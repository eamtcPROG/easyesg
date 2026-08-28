'use client';

import { Button, Callout, CALLOUT_INTENT, Panel, TextLink } from '@easyesg/ui';
import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { API_OUTCOME } from '@/lib/api-outcome';
import { Link } from '@/i18n/navigation';
import { verifyEmailAction } from '../actions';
import { forgetPendingVerification } from '../pending-verification-store';
import type { VerifyResult } from '../types/action-results';
import styles from './identity-screens.module.css';
import { ROUTES } from '@/lib/routes';

/**
 * S-02 · the verification link's landing surface (UC-03) — `/verify?token=…`.
 *
 * The token is consumed by an explicit button, never on page load: the API sends it in a POST
 * body precisely so a mail scanner prefetching the URL cannot burn the single use (task 19's
 * controller states this), and a GET that mutated on render would re-introduce exactly that.
 *
 * **`returnTo` is the invitation detour** (26 Aug 2026 review): S-03 → registration with a stale
 * token → an ordinary challenge → here. Carrying it means the success state offers sign-in *back to
 * the invitation* rather than to a blank one, which is what stops the link being orphaned. Absent on
 * every other arrival, which is most of them.
 *
 * States (§8.1 subset): rest (explanation + one primary action) · confirming (pending-async) ·
 * success (account active, next step offered — never a bare toast for a consequential action) ·
 * error — recoverable (the problem's own three-part text as received, with the resend route as
 * the way out, per §8.4's finding-to-destination rule) · unreachable (bundled catalogue).
 */
export function ConfirmEmail({ token, returnTo }: { token: string; returnTo?: string }) {
  const t = useTranslations('identity.verify');
  const tCommon = useTranslations('identity');
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<VerifyResult | null>(null);

  const confirm = () => {
    startTransition(async () => {
      const outcome = await verifyEmailAction({ token });
      if (outcome.status === API_OUTCOME.Ok) {
        // The challenge is answered; the pending screen's stored address has no reader left.
        forgetPendingVerification();
      }
      setResult(outcome);
    });
  };

  if (result?.status === API_OUTCOME.Ok) {
    return (
      <Callout
        intent={CALLOUT_INTENT.SUCCESS}
        title={t('successTitle')}
        action={
          <TextLink asChild>
            <Link href={returnTo ? `${ROUTES.SIGN_IN}?return=${encodeURIComponent(returnTo)}` : '/sign-in'}>
              {t('successAction')}
            </Link>
          </TextLink>
        }
      >
        {t('successBody')}
      </Callout>
    );
  }

  return (
    <div className={styles.stack}>
      {result?.status === API_OUTCOME.Problem ? (
        <Callout
          intent={CALLOUT_INTENT.ERROR}
          title={result.problem.title ?? t('problemTitle')}
          action={
            <TextLink asChild>
              <Link href={ROUTES.VERIFY}>{t('problemAction')}</Link>
            </TextLink>
          }
        >
          {result.problem.detail ?? t('problemBody')}
        </Callout>
      ) : null}

      {result?.status === API_OUTCOME.Unreachable ? (
        <Callout
          intent={CALLOUT_INTENT.ERROR}
          title={tCommon('unreachable.title')}
          action={tCommon('unreachable.action')}
        >
          {tCommon('unreachable.body')}
        </Callout>
      ) : null}

      <Panel className={styles.formPanel}>
        <p className={styles.bodyText}>{t('confirmIntro')}</p>
        <Button busy={pending} onClick={confirm}>
          {t('confirm')}
        </Button>
      </Panel>
    </div>
  );
}
