'use client';

import { Button, Select } from '@easyesg/ui';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { ROUTES } from '@/lib/routes';
import {
  REPORT_FILTER_ANY,
  REPORT_STATUS_FILTERS,
  type ReportFilterOptions,
  type ReportView,
} from '../tools/reports';
import { REPORTS_MESSAGES } from './reports-messages';
import styles from './reports.module.css';

/**
 * The Index's filter row (§4.6): the three facets, and *new report* at the row's end. This is S-13's row, which S-06
 * now uses as S-14 does (project owner, 30 Sep 2026); the action used to stand at the heading's end. The action sits
 * with the list it adds to, and only once the list has been read, so a refused or failed read draws neither.
 *
 * **Absent for a view-only member**, since FR-25's *"no edit affordances"* covers the one write this screen offers,
 * which the heading's button used to carry. The facets stay: a viewer sees the same entries, filtered the same way.
 *
 * **A link, not a button**: the creation flow is an address of its own (UX-4), so the action is a navigation.
 */
export function ReportsToolbar({
  view,
  options,
  canCreate,
  onViewChangeAction,
}: {
  readonly view: ReportView;
  readonly options: ReportFilterOptions;
  readonly canCreate: boolean;
  readonly onViewChangeAction: (next: Partial<ReportView>) => void;
}) {
  const t = useTranslations(REPORTS_MESSAGES);

  return (
    <div className={styles.toolbar}>
      <div className={styles.filters}>
        <Select
          label={t('filter.entity')}
          value={view.entity}
          onValueChange={(next) => onViewChangeAction({ entity: next })}
          options={[
            { value: REPORT_FILTER_ANY, label: t('filter.options.anyEntity') },
            ...options.entities.map((entity) => ({ value: entity.id, label: entity.name })),
          ]}
        />
        <Select
          label={t('filter.year')}
          value={view.year}
          onValueChange={(next) => onViewChangeAction({ year: next })}
          options={[
            { value: REPORT_FILTER_ANY, label: t('filter.options.anyYear') },
            ...options.years.map((year) => ({ value: String(year), label: String(year) })),
          ]}
        />
        <Select
          label={t('filter.status')}
          value={view.status}
          onValueChange={(next) => onViewChangeAction({ status: next as ReportView['status'] })}
          options={REPORT_STATUS_FILTERS.map((option) => ({
            value: option,
            label: t(`filter.options.${option}`),
          }))}
        />
      </div>
      {canCreate ? (
        <Button asChild className={styles.toolbarButton}>
          <Link href={ROUTES.REPORT_NEW}>{t('add')}</Link>
        </Button>
      ) : null}
    </div>
  );
}
