import type { SupportAccessRequest } from '@easyesg/contracts';
import { Banner, CALLOUT_INTENT } from '@easyesg/ui';
import { getFormatter, getTranslations } from 'next-intl/server';
import { RequestDetails } from '../../shared/request-details';
import { AnswerControls } from '../controls/answer-controls';

/**
 * A request waiting for an answer (task 67.9; UX-124) — which only an Organization Administrator is sent, so
 * whoever reads this banner may answer it. It says who is asking, against which ticket and why, **what granting
 * means before the button does** — 60 minutes, read-only, seen by every member, ended by any administrator — and
 * when it lapses unanswered.
 */
export async function AwaitingBanner({ request }: { readonly request: SupportAccessRequest }) {
  const [t, format] = await Promise.all([getTranslations('supportAccess'), getFormatter()]);

  return (
    <Banner
      intent={CALLOUT_INTENT.ATTENTION}
      title={t('awaiting.title', { operator: request.requesterEmail ?? t('unknownOperator') })}
      action={
        <AnswerControls
          requestId={request.id}
          labels={{ grant: t('awaiting.grant'), decline: t('awaiting.decline') }}
          unreachable={{ title: t('unreachable.title'), body: t('unreachable.body') }}
        />
      }
    >
      <p>{t('awaiting.body')}</p>
      <RequestDetails request={request} labels={{ ticket: t('ticket'), reason: t('reason') }} />
      <p>{t('awaiting.lapses', { time: format.dateTime(request.lapsesAt, 'stamp') })}</p>
    </Banner>
  );
}
