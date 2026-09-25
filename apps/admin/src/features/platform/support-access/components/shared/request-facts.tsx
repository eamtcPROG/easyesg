import type { SupportAccessLogEntry } from '@easyesg/contracts';
import { useTranslations } from 'use-intl';

/**
 * A request's ticket and reason, as the operator wrote them for the organization (task 67.9) — read by the list of
 * what is in progress and by the log's record, which is its admission here.
 *
 * **Label over value below `sm`, side by side above it, and an unbroken value wraps anywhere** (task 170; UX-77 as
 * amended): a ticket reference is one word as long as the operator typed it, and must not widen the page.
 */
export function RequestFacts({ entry }: { readonly entry: Pick<SupportAccessLogEntry, 'ticketReference' | 'reason'> }) {
  const t = useTranslations('platform.supportAccess.grant');

  return (
    <dl className="t-body grid grid-cols-1 gap-x-[var(--space-4)] gap-y-[var(--space-1)] wrap-anywhere sm:grid-cols-[auto_1fr]">
      <dt className="text-[var(--text-muted)]">{t('ticket')}</dt>
      <dd>{entry.ticketReference}</dd>
      <dt className="text-[var(--text-muted)]">{t('reason')}</dt>
      <dd>{entry.reason}</dd>
    </dl>
  );
}
