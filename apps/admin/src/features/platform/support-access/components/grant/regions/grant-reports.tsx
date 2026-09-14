import { useQuery } from '@tanstack/react-query';
import { API_OUTCOME } from '@easyesg/contracts';
import { BUTTON_VARIANT, Button } from '@easyesg/ui';
import { useTranslations } from 'use-intl';
import { grantReportsQuery } from '../../../queries/support-access';
import type { GrantScope } from '../../../tools/support-access-search';
import { SupportAccessLoading } from '../../shared/support-access-loading';
import { GrantFailure } from '../shared/grant-failure';

/**
 * The organization's reports under a grant (task 67.9) — the list its own S-06 shows, by entity and year, each
 * opening its modules. Reading it writes one access row.
 */
export function GrantReports({
  grant,
  onOpen,
  onClose,
}: {
  readonly grant: GrantScope;
  readonly onOpen: (reportId: string) => void;
  readonly onClose: () => void;
}) {
  const t = useTranslations('platform.supportAccess.grant');
  const query = useQuery(grantReportsQuery(grant));

  if (query.data === undefined) return <SupportAccessLoading />;
  if (query.data.status !== API_OUTCOME.Ok) {
    return <GrantFailure failure={query.data} onRetry={() => void query.refetch()} onClose={onClose} />;
  }

  const reports = query.data.value.items;
  return (
    <div className="flex flex-col gap-[var(--space-3)]">
      <h3 className="t-body-strong">{t('reports')}</h3>
      {reports.length === 0 ? (
        <p className="t-body text-[var(--text-muted)]">{t('noReports')}</p>
      ) : (
        <ul className="flex flex-col gap-[var(--space-1)]">
          {reports.map((report) => (
            <li key={report.id}>
              <Button type="button" variant={BUTTON_VARIANT.SUBTLE} onClick={() => onOpen(report.id)}>
                {t('report', { entity: report.subject.entityName, year: String(report.subject.fiscalYear) })}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
