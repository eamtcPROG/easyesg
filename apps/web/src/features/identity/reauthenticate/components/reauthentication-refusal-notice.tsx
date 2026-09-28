'use client';

import { CALLOUT_INTENT, ExpiringCallout, TextLink, useDismissible, type CalloutIntent } from '@easyesg/ui';
import type { ReactNode } from 'react';
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
 *
 * **Each arm leaves after a while, or when closed** (`design_spec.md` §8.1, 28 Sep 2026): every one is what the last
 * press was answered with, so the arm decides the words and one Expiring callout draws them. The next attempt's
 * refusal is a new object in the dialogue's reducer and shows again.
 */
export function ReauthenticationRefusalNotice({
  refusal,
}: {
  readonly refusal: ReauthenticationRefusal | null;
}) {
  const t = useTranslations('identity.reauthenticate');
  const tIdentity = useTranslations('identity');
  const tForms = useTranslations('forms');
  const [shown, dismiss] = useDismissible(refusal);

  if (shown === null) return null;

  const message = ((): {
    readonly intent: CalloutIntent;
    readonly title: string;
    readonly body: string;
    readonly action: ReactNode | null;
  } => {
    if (shown.kind === REAUTHENTICATION_REFUSAL.LAPSED) {
      return { intent: CALLOUT_INTENT.WARNING, title: t('lapsedTitle'), body: t('lapsedBody'), action: null };
    }
    if (shown.kind === REAUTHENTICATION_REFUSAL.ACCOUNT_CHANGED) {
      return {
        intent: CALLOUT_INTENT.WARNING,
        title: t('accountChangedTitle'),
        body: t('accountChangedBody'),
        action: null,
      };
    }
    if (shown.failure.status === API_OUTCOME.Unreachable) {
      return {
        intent: CALLOUT_INTENT.ERROR,
        title: tIdentity('unreachable.title'),
        body: tIdentity('unreachable.body'),
        action: tIdentity('unreachable.action'),
      };
    }
    const { problem } = shown.failure;
    return {
      intent: CALLOUT_INTENT.ERROR,
      title: problem.title ?? t('problemTitle'),
      body: problem.detail ?? t('problemBody'),
      action: refusalIsLockout(shown) ? (
        <TextLink asChild>
          <Link href={ROUTES.RESET}>{t('lockedAction')}</Link>
        </TextLink>
      ) : null,
    };
  })();

  return (
    <ExpiringCallout
      intent={message.intent}
      title={message.title}
      action={message.action}
      dismissLabel={tForms('closeMessage')}
      onDismiss={dismiss}
    >
      {message.body}
    </ExpiringCallout>
  );
}
