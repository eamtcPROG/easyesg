'use client';

import {
  BUTTON_VARIANT,
  Button,
  EmptyState,
  Select,
  StatusChip,
  STATUS_TONE,
  TextLink,
  VersionPinIndicator,
} from '@easyesg/ui';
import type { DataTableColumn, StatusTone } from '@easyesg/ui';
import { useTranslations } from 'next-intl';
import { useCallback, useMemo, useTransition } from 'react';
import { IndexView } from '@/shared/index-view';
import { Link, useRouter } from '@/i18n/navigation';
import { entityPeriodsRoute, newPeriodRoute, periodRoute, withQuery } from '@/lib/routes';
import {
  PERIOD_FILTER_ANY,
  PERIOD_SORT,
  PERIOD_STANDING,
  PERIOD_STANDING_FILTERS,
  periodViewQuery,
  type PeriodPage,
  type PeriodRow,
  type PeriodSort,
  type PeriodStanding,
  type PeriodView,
} from '../periods';
import styles from './periods.module.css';

/**
 * S-14's list, as an instance of the Index archetype (§4.6).
 *
 * `EntitiesList`'s shape — everything that is not about *this* screen is `IndexShell` and the app's
 * `IndexView` binding, and a row navigates rather than acts, so the only state is the view and the
 * view lives in the address (UX-4). No provider and no reducer for one value.
 */

/** Columns that are not sort dimensions, declared rather than written as a union — the convention's
 *  own reason: a hand-written union has no runtime value, so a typo makes a second column. */
const PERIOD_COLUMN = { DATES: 'dates', PIN: 'pin' } as const;

export type PeriodColumnKey = PeriodSort | (typeof PERIOD_COLUMN)[keyof typeof PERIOD_COLUMN];

/**
 * Open is positive; locked is **neutral, not an error**. FR-22 makes locking a deliberate act that
 * gives the change history a defensible endpoint — a reader whose period is locked has done the
 * right thing, and an alarming tone would say otherwise. `EntitiesList` draws archived the same way
 * for the same reason.
 */
const STANDING_TONE: Record<PeriodStanding, StatusTone> = {
  [PERIOD_STANDING.OPEN]: STATUS_TONE.POSITIVE,
  [PERIOD_STANDING.LOCKED]: STATUS_TONE.NEUTRAL,
};

export interface PeriodsListProps {
  readonly entityId: string;
  readonly page: PeriodPage;
  readonly view: PeriodView;
}

export function PeriodsList({ entityId, page, view }: PeriodsListProps) {
  const t = useTranslations('organization.periods');
  const router = useRouter();
  const [, startNavigation] = useTransition();

  const setView = useCallback(
    (next: Partial<PeriodView>) => {
      // Any filter or sort change resets the page: staying on page 3 of a list that has become one
      // page long shows nothing and reads as "no matches", which is a different screen.
      const resetsPage = next.page === undefined;
      const query = periodViewQuery({ ...view, ...next, ...(resetsPage ? { page: 1 } : {}) });
      startNavigation(() => {
        router.push(withQuery(entityPeriodsRoute(entityId), query));
      });
    },
    [entityId, router, view],
  );

  const columns = useMemo<DataTableColumn<PeriodRow, PeriodColumnKey>[]>(
    () => [
      {
        key: PERIOD_SORT.YEAR,
        header: t('columns.year'),
        sortable: true,
        cell: (row) => (
          <TextLink asChild>
            <Link href={periodRoute({ entityId, periodId: row.id })}>{row.fiscalYear}</Link>
          </TextLink>
        ),
      },
      {
        key: PERIOD_COLUMN.DATES,
        header: t('columns.dates'),
        // Rendered as the ISO days they are, not reformatted: NFR-26 wants a locale-derived format
        // and §11.5 has no date-display component yet, so inventing a format here would be the
        // one-off UX-89 forbids. The boundary is exact and unambiguous meanwhile, which is the
        // property that matters most on this screen.
        cell: (row) => (
          <span className="t-numeric">{t('columns.datesValue', { start: row.start, end: row.end })}</span>
        ),
      },
      {
        key: PERIOD_SORT.DUE,
        header: t('columns.due'),
        sortable: true,
        cell: (row) =>
          row.due === null ? (
            <span className="t-caption">{t('columns.dueNone')}</span>
          ) : (
            <span className="t-numeric">{row.due}</span>
          ),
      },
      {
        key: PERIOD_COLUMN.PIN,
        header: t('columns.pin'),
        // DR-4 made visible. The indicator carries no standing here because nothing yet tells a
        // screen a version has been superseded — task 33.3 registers the second version that makes
        // the question answerable, and until then claiming *in force* is the only honest answer.
        cell: (row) => (
          <VersionPinIndicator label={t('columns.taxonomy')} version={row.taxonomyVersion} />
        ),
      },
      {
        key: PERIOD_SORT.STANDING,
        header: t('columns.standing'),
        sortable: true,
        cell: (row) => (
          <StatusChip tone={STANDING_TONE[row.standing]}>{t(`standing.${row.standing}`)}</StatusChip>
        ),
      },
    ],
    [entityId, t],
  );

  return (
    <>
      <div className={styles.filters}>
        <Select
          label={t('filter.standing')}
          value={view.standing}
          onValueChange={(next) => setView({ standing: next as PeriodView['standing'] })}
          options={PERIOD_STANDING_FILTERS.map((option) => ({
            value: option,
            label: t(`filter.options.${option}`),
          }))}
        />
      </div>

      <IndexView<PeriodRow, PeriodColumnKey>
        page={page}
        caption={t('caption')}
        columns={columns}
        rowKey={(row) => row.id}
        sort={{ column: view.sort, direction: view.direction }}
        onSortChange={(sort) =>
          setView({ sort: sort.column as PeriodSort, direction: sort.direction })
        }
        onPageChange={(next) => setView({ page: next })}
        empty={{
          firstUse: (
            // §4.6: an Index "always has an empty state that teaches", and teaching here means
            // saying what a period IS — the year a report is prepared for — because a reader who
            // has just created an entity has no reason to know that yet.
            <EmptyState
              title={t('empty.firstUse.title')}
              action={
                <Button asChild>
                  <Link href={newPeriodRoute(entityId)}>{t('empty.firstUse.action')}</Link>
                </Button>
              }
            >
              {t('empty.firstUse.body')}
            </EmptyState>
          ),
          filtered: (
            <EmptyState
              title={t('empty.filtered.title')}
              action={
                <Button
                  variant={BUTTON_VARIANT.SUBTLE}
                  onClick={() => setView({ standing: PERIOD_FILTER_ANY })}
                >
                  {t('empty.filtered.action')}
                </Button>
              }
            >
              {t('empty.filtered.body')}
            </EmptyState>
          ),
        }}
      />
    </>
  );
}
