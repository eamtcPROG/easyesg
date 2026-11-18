import type { MigrationRunOrganization } from '@easyesg/contracts';
import { DataTable } from '@easyesg/ui';
import { useTranslations } from 'use-intl';
import { reportsIn, shownStatuses } from '../../tools/run-progress';

/**
 * A run's progress per organization, as the artboard states it rather than as a spinner (task 67.7): how many of its
 * reports the run selected, how many are still pending, and where the rest stand — counts only (182/43).
 */
export function RunOrganizations({ organizations }: { readonly organizations: readonly MigrationRunOrganization[] }) {
  const t = useTranslations('platform.taxonomy.run');
  return (
    <DataTable
      caption={t('organizations')}
      rows={organizations}
      rowKey={(row) => row.organizationId}
      columns={[
        { key: 'name', header: t('columns.organization'), cell: (row) => row.name },
        { key: 'selected', header: t('columns.selected'), cell: (row) => row.selected },
        { key: 'pending', header: t('columns.pending'), cell: (row) => row.pending },
        {
          key: 'outcome',
          header: t('columns.outcome'),
          cell: (row) =>
            shownStatuses(row.tally)
              .map((status) => t('outcome', { status: t(`statuses.${status}`), reports: reportsIn(row.tally, status) }))
              .join(' · '),
        },
      ]}
    />
  );
}
