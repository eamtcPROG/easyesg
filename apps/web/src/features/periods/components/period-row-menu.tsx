'use client';

import { OverflowMenu } from '@easyesg/ui';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import type { PeriodsFrom } from '@/lib/periods-from';
import { periodRoute } from '@/lib/routes';
import { PERIOD_STANDING, type PeriodRow } from '../tools/periods';
import { PERIODS_MESSAGES } from './periods-messages';

/**
 * A row's ⋯ on S-14 (19 Oct 2026, project owner: a table's row actions are one menu, as S-13's and S-06's are;
 * `design_spec.md` S-14's row) — named for its year, holding the period's record to **edit** where it is open, or to
 * **view** where it is locked and its record is read-only (FR-22). The year itself stays a link to the same record, so
 * the menu is a shortcut and never the only way. It keeps the list's origin, so the record leads back where it came from.
 */
export function PeriodRowMenu({
  entityId,
  row,
  from,
}: {
  readonly entityId: string;
  readonly row: PeriodRow;
  readonly from: PeriodsFrom | null;
}) {
  const t = useTranslations(`${PERIODS_MESSAGES}.rowActions`);
  const router = useRouter();
  const edits = row.standing === PERIOD_STANDING.OPEN;
  // A year as a string, never a number ICU would group ("2 026").
  const year = String(row.fiscalYear);
  return (
    <OverflowMenu
      label={t('menu', { year })}
      items={[
        {
          key: 'record',
          label: edits ? t('edit') : t('view'),
          onSelect: () => router.push(periodRoute({ entityId, periodId: row.id, from })),
        },
      ]}
    />
  );
}
