import type { SupportAccessLogEntry } from '@easyesg/contracts';
import { useTranslations } from 'use-intl';

/**
 * A request's ticket and reason, as the operator wrote them for the organization (task 67.9) — read by the list of
 * what is in progress and by the log's record, which is its admission here.
 */
export function RequestFacts({ entry }: { readonly entry: Pick<SupportAccessLogEntry, 'ticketReference' | 'reason'> }) {
  const t = useTranslations('platform.supportAccess.grant');

  return (
    <dl className="t-body grid grid-cols-[auto_1fr] gap-x-[var(--space-4)] gap-y-[var(--space-1)]">
      <dt className="text-[var(--text-muted)]">{t('ticket')}</dt>
      <dd>{entry.ticketReference}</dd>
      <dt className="text-[var(--text-muted)]">{t('reason')}</dt>
      <dd>{entry.reason}</dd>
    </dl>
  );
}
