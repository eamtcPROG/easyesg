import type { SupportAccessRequest } from '@easyesg/contracts';
import { Banner, CALLOUT_INTENT } from '@easyesg/ui';
import { getFormatter, getTranslations } from 'next-intl/server';
import { RequestDetails } from '../../shared/request-details';
import { SUPPORT_ACCESS_MESSAGES } from '../../shared/support-access-messages';
import { EndControl } from '../controls/end-control';

/**
 * Access running now (task 67.9; UX-124) — shown to **every member**: who at EasyESG is reading, against which
 * ticket and for what reason, and when it ends by itself. An Organization Administrator is offered *End access*;
 * everyone else is told who can end it, which is the banner's third part for them.
 *
 * **The time left is written when the page renders**, from the request's clock rather than the reader's browser,
 * so a screen held open reads *in 42 minutes* until its next navigation — the expiry instant beside it is what
 * stays true, and access ends on the server at that instant whatever the screen says.
 */
export async function ActiveBanner({
  request,
  now,
  mayEnd,
}: {
  readonly request: SupportAccessRequest;
  readonly now: Date;
  readonly mayEnd: boolean;
}) {
  // Only a granted request is running, and the API sends a granted request's expiry; a running request without
  // one is not a state this banner can describe honestly, so it says nothing rather than guessing a time.
  if (request.expiresAt === null) return null;

  const [t, format] = await Promise.all([getTranslations(SUPPORT_ACCESS_MESSAGES), getFormatter()]);

  return (
    <Banner
      intent={CALLOUT_INTENT.WARNING}
      title={t('active.title', { operator: request.requesterEmail ?? t('unknownOperator') })}
      action={mayEnd ? <EndControl requestId={request.id} /> : null}
    >
      <p>
        {t('active.body', {
          time: format.dateTime(request.expiresAt, 'stamp'),
          left: format.relativeTime(request.expiresAt, now),
        })}
      </p>
      <RequestDetails request={request} labels={{ ticket: t('ticket'), reason: t('reason') }} />
      {mayEnd ? null : <p>{t('active.endNote')}</p>}
    </Banner>
  );
}
