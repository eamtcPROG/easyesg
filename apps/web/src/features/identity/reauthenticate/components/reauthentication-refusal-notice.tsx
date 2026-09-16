'use client';

import { CALLOUT_INTENT, Callout, TextLink } from '@easyesg/ui';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { API_OUTCOME } from '@/lib/api-outcome';
import { ROUTES } from '@/lib/routes';
import {
  REAUTHENTICATION_REFUSAL,
  refusalIsLockout,
  type ReauthenticationRefusal,
} from '../tools/reauthentication-state';

/**
 * Why the last attempt did not resume the session (task 92) — one callout above the stage, or nothing.
 *
 * **The api's refusal is rendered as received.** NFR-79 has the api compose all three parts into
 * `detail`, so the action slot says nothing further (`apps/web/CLAUDE.md`'s `action={null}` rule) — except
 * for the lockout, whose remedy is another screen: the reset link, the one release before Phase 8, and the
 * one way out of the dialogue besides its own two. The two refusals this tier minted itself — a lapsed
 * challenge, another account in the browser — carry catalogue words, each naming what now in its body.
 */
export function ReauthenticationRefusalNotice({
  refusal,
}: {
  readonly refusal: ReauthenticationRefusal | null;
}) {
  const t = useTranslations('identity.reauthenticate');
  const tIdentity = useTranslations('identity');

  if (refusal === null) return null;

  if (refusal.kind === REAUTHENTICATION_REFUSAL.LAPSED) {
    return (
      <Callout intent={CALLOUT_INTENT.WARNING} title={t('lapsedTitle')} action={null}>
        {t('lapsedBody')}
      </Callout>
    );
  }

  if (refusal.kind === REAUTHENTICATION_REFUSAL.ACCOUNT_CHANGED) {
    return (
      <Callout intent={CALLOUT_INTENT.WARNING} title={t('accountChangedTitle')} action={null}>
        {t('accountChangedBody')}
      </Callout>
    );
  }

  if (refusal.failure.status === API_OUTCOME.Unreachable) {
    return (
      <Callout
        intent={CALLOUT_INTENT.ERROR}
        title={tIdentity('unreachable.title')}
        action={tIdentity('unreachable.action')}
      >
        {tIdentity('unreachable.body')}
      </Callout>
    );
  }

  const { problem } = refusal.failure;
  return (
    <Callout
      intent={CALLOUT_INTENT.ERROR}
      title={problem.title ?? t('problemTitle')}
      action={
        refusalIsLockout(refusal) ? (
          <TextLink asChild>
            <Link href={ROUTES.RESET}>{t('lockedAction')}</Link>
          </TextLink>
        ) : null
      }
    >
      {problem.detail ?? t('problemBody')}
    </Callout>
  );
}
