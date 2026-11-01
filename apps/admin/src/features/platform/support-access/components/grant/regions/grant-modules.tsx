import { useQuery } from '@tanstack/react-query';
import { API_OUTCOME } from '@easyesg/contracts';
import { BUTTON_VARIANT, Button } from '@easyesg/ui';
import { useTranslations } from 'use-intl';
import { grantModulesQuery } from '../../../queries/support-access';
import type { GrantScope } from '../../../tools/support-access-search';
import { SupportAccessLoading } from '../../shared/support-access-loading';
import { GrantFailure } from '../shared/grant-failure';

/**
 * One report's modules under a grant (task 67.9) — as the organization's wizard lists them, with how much of each is
 * answered, each opening its values. Reading it writes one access row naming the report.
 */
export function GrantModules({
  grant,
  reportId,
  onOpen,
  onBack,
  onClose,
}: {
  readonly grant: GrantScope;
  readonly reportId: string;
  readonly onOpen: (module: string) => void;
  readonly onBack: () => void;
  readonly onClose: () => void;
}) {
  const t = useTranslations('platform.supportAccess.grant');
  const query = useQuery(grantModulesQuery({ ...grant, reportId }));

  if (query.data === undefined) return <SupportAccessLoading />;
  if (query.data.status !== API_OUTCOME.Ok) {
    return <GrantFailure failure={query.data} onRetry={() => void query.refetch()} onClose={onClose} />;
  }

  return (
    <div className="flex flex-col gap-[var(--space-3)]">
      <div>
        <Button type="button" variant={BUTTON_VARIANT.SUBTLE} onClick={onBack}>
          {t('backToReports')}
        </Button>
      </div>
      <h3 className="t-body-strong">{t('modules')}</h3>
      <ul className="flex flex-col gap-[var(--space-1)]">
        {query.data.value.items.map((summary) => (
          <li key={summary.module}>
            <Button type="button" variant={BUTTON_VARIANT.SUBTLE} onClick={() => onOpen(summary.module)}>
              {t('module', { module: summary.module, answered: summary.answered, total: summary.total })}
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
