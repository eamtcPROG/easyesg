import { Link } from '@tanstack/react-router';
import type { ApiFailure } from '@easyesg/contracts';
import { Panel, TextLink } from '@easyesg/ui';
import { useTranslations } from 'use-intl';
import { RefusalCallout } from '../shared/refusal-callout';

/**
 * A-20's *not acceptable* state (task 67.4): a link that expired, was withdrawn, was replaced by a
 * resend or was already used. **Which of those is the api's sentence** — each standing has its own —
 * and the way on is the same for all of them: sign in, if the account exists, or ask for a new link.
 */
export function InvitationRefused({ failure }: { readonly failure: ApiFailure }) {
  const t = useTranslations('realm.invitation.refused');

  return (
    <Panel className="flex flex-col gap-[var(--space-4)]">
      <RefusalCallout failure={failure} title={t('title')} fallback={t('body')} />
      <p className="t-caption">
        <TextLink asChild>
          <Link to="/sign-in">{t('action')}</Link>
        </TextLink>
      </p>
    </Panel>
  );
}
