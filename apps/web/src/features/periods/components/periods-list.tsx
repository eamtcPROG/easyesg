'use client';

import {
  BUTTON_VARIANT,
  Button,
  COLUMN_ALIGN,
  COLUMN_SIZE,
  EmptyState,
  StatusChip,
  TextLink,
  VersionPinIndicator,
} from '@easyesg/ui';
import type { DataTableColumn } from '@easyesg/ui';
import { useTranslations } from 'next-intl';
import { useCallback, useMemo, useTransition } from 'react';
import { IndexView } from '@/shared/index-view';
import { Link, useRouter } from '@/i18n/navigation';
import { entityPeriodsRoute, newPeriodRoute, periodRoute, withQuery } from '@/lib/routes';
import {
  PERIOD_FILTER_ANY,
  PERIOD_SORT,
  PERIOD_STANDING,
  PERIOD_STANDING_TONE,
  periodViewQuery,
  type PeriodPage,
  type PeriodRow,
  type PeriodSort,
  type PeriodView,
} from '../tools/periods';
import { PERIODS_MESSAGES } from './periods-messages';
import { PeriodsToolbar } from './periods-toolbar';

/**
 * S-14's list, as an instance of the Index archetype (§4.6).
 *
 * `EntitiesList`'s shape — everything that is not about *this* screen is `IndexShell` and the app's
 * `IndexView` binding, and a row navigates rather than acts, so the only state is the view and the
 * view lives in the address (UX-4). No provider and no reducer for one value.
 */

/** Columns that are not sort dimensions, declared rather than written as a union — the convention's
 *  own reason: a hand-written union has no runtime value, so a typo makes a second column. */
const PERIOD_COLUMN = { DATES: 'dates', PIN: 'pin', ACTIONS: 'actions' } as const;

export type PeriodColumnKey = PeriodSort | (typeof PERIOD_COLUMN)[keyof typeof PERIOD_COLUMN];

export interface PeriodsListProps {
  readonly entityId: string;
  readonly page: PeriodPage;
  readonly view: PeriodView;
}

export function PeriodsList({ entityId, page, view }: PeriodsListProps) {
  const t = useTranslations(PERIODS_MESSAGES);
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
          <StatusChip tone={PERIOD_STANDING_TONE[row.standing]}>{t(`standing.${row.standing}`)}</StatusChip>
        ),
      },
      {
        // 30 Sep 2026, project owner: each row ends in a labelled action, as S-13's rows do — *edit* for an open period
        // and *view* for a locked one, whose record is read-only (FR-22). The year stays a link to the same record.
        key: PERIOD_COLUMN.ACTIONS,
        header: t('columns.actions'),
        align: COLUMN_ALIGN.END,
        size: COLUMN_SIZE.FIT,
        cell: (row) => {
          const edits = row.standing === PERIOD_STANDING.OPEN;
          // A year as a string, never a number ICU would group ("2 026").
          const year = String(row.fiscalYear);
          return (
            <Button asChild variant={BUTTON_VARIANT.SECONDARY}>
              <Link
                href={periodRoute({ entityId, periodId: row.id })}
                // The visible word, and a name that begins with it (WCAG 2.5.3) and ends with the row.
                aria-label={edits ? t('rowActions.editNamed', { year }) : t('rowActions.viewNamed', { year })}
              >
                {edits ? t('rowActions.edit') : t('rowActions.view')}
              </Link>
            </Button>
          );
        },
      },
    ],
    [entityId, t],
  );

  return (
    <>
      <PeriodsToolbar
        entityId={entityId}
        standing={view.standing}
        onStandingChangeAction={(standing) => setView({ standing })}
      />

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
