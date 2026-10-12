'use client';

import {
  Button,
  BUTTON_VARIANT,
  COLUMN_SIZE,
  EmptyState,
  toPageSize,
  TextLink,
  VersionPinIndicator,
} from '@easyesg/ui';
import type { DataTableColumn } from '@easyesg/ui';
import { useFormatter, useTranslations } from 'next-intl';
import { useCallback, useMemo, useTransition } from 'react';
import { IndexView } from '@/shared/index-view';
import { ListSearch } from '@/shared/list-search';
import { ReportCompletion } from '@/shared/report-completion';
import { Link, useRouter } from '@/i18n/navigation';
import { ROUTES, reportRoute, withQuery } from '@/lib/routes';
import {
  REPORT_FILTER_ANY,
  REPORT_SORT,
  reportViewQuery,
  type ReportFilterOptions,
  type ReportPage,
  type ReportRow,
  type ReportSort,
  type ReportView,
} from '../tools/reports';
import { REPORTS_MESSAGES } from './reports-messages';
import { ReportRowActions } from './report-row-actions';
import { ReportState } from './report-state';
import { ReportsToolbar } from './reports-toolbar';
import styles from './reports.module.css';

/**
 * S-06's list, as an instance of the Index archetype (§4.6) — UC-17, FR-25.
 *
 * `PeriodsList`'s shape: everything that is not about *this* screen is `IndexShell` and the app's
 * `IndexView` binding, a row navigates rather than acts, and the only state is the view, which
 * lives in the address (UX-4). No provider and no reducer for values nothing else moves with.
 *
 * **Opening the report is what every row can do, so the subject's name is every row's link**; the artboard draws
 * *Continue · Open · Preview* by state, and each is that same link. **A filed row ends in *Download*** since task 216 —
 * its latest file, for an editor or the administrator, a view-only member being refused the file (182/22) — and its
 * state names the day it was filed and how many files it has (`ReportState`). **And since task 192 the
 * administrator's ⋯ ends each row**, holding *Delete this report* (`architecture.md` §12.5.6's task-192 row (3)) —
 * absent for anyone else, whose menu would hold nothing. The actions column is drawn where either can appear.
 */

/** Columns that are not sort dimensions, declared rather than written as a union — the
 *  convention's own reason: a hand-written union has no runtime value, so a typo makes a second
 *  column instead of failing. */
const REPORT_COLUMN = { PERIOD: 'period', COMPLETION: 'completion', PIN: 'pin', ACTIONS: 'actions' } as const;

export type ReportColumnKey = ReportSort | (typeof REPORT_COLUMN)[keyof typeof REPORT_COLUMN];

export interface ReportsListProps {
  readonly page: ReportPage;
  readonly view: ReportView;
  /** What the entity and year facets offer, read off the rows by the section. */
  readonly options: ReportFilterOptions;
  /**
   * FR-25's view-only clause: *"a view-only member sees the same entries and no edit affordances"*.
   * The rows are unchanged; the filter row's *new report* and the teaching empty state's action both
   * go, because creating a report is the one write this screen offers and a viewer's would be refused.
   */
  readonly canCreate: boolean;
  /** The Organization Administrator's: whether each row ends in the ⋯ that deletes it (UC-213; task 192). */
  readonly canDelete: boolean;
  /** An editor's or the administrator's: whether a filed row ends in *Download* (FR-53; 182/22; task 216). */
  readonly canDownload: boolean;
}

export function ReportsList({ page, view, options, canCreate, canDelete, canDownload }: ReportsListProps) {
  const t = useTranslations(REPORTS_MESSAGES);
  const format = useFormatter();
  const router = useRouter();
  const [, startNavigation] = useTransition();

  const setView = useCallback(
    (next: Partial<ReportView>) => {
      // Any filter or sort change resets the page: staying on page 3 of a list that has become one
      // page long shows nothing and reads as "no matches", which is a different screen.
      const resetsPage = next.page === undefined;
      const query = reportViewQuery({ ...view, ...next, ...(resetsPage ? { page: 1 } : {}) });
      startNavigation(() => {
        router.push(withQuery(ROUTES.REPORTS, query));
      });
    },
    [router, view],
  );

  const columns = useMemo<DataTableColumn<ReportRow, ReportColumnKey>[]>(
    () => [
      {
        key: REPORT_SORT.ENTITY,
        header: t('columns.entity'),
        sortable: true,
        cell: (row) => (
          <span className={styles.subject}>
            <TextLink asChild>
              <Link href={reportRoute(row.id)}>{row.entityName}</Link>
            </TextLink>
            {/* D-A's scope, under the name — the artboard's "VSME Basic" line. The export
                languages it also draws are task 46's and are not shown. */}
            <span className="t-caption">{t(`scope.${row.scope}`)}</span>
          </span>
        ),
      },
      {
        key: REPORT_SORT.YEAR,
        header: t('columns.year'),
        sortable: true,
        cell: (row) => <span className="t-numeric">{row.fiscalYear}</span>,
      },
      {
        key: REPORT_COLUMN.PERIOD,
        header: t('columns.period'),
        // The ISO days as they are, not reformatted — `PeriodsList` records the reason: NFR-26
        // wants a locale-derived format, §11.5 carries no date-display component, and inventing one
        // here is the one-off UX-89 forbids.
        cell: (row) => (
          <span className="t-numeric">
            {t('columns.periodValue', { start: row.start, end: row.end })}
          </span>
        ),
      },
      {
        key: REPORT_SORT.STATUS,
        header: t('columns.status'),
        sortable: true,
        cell: (row) => <ReportState row={row} />,
      },
      {
        key: REPORT_COLUMN.COMPLETION,
        header: t('columns.completion'),
        // FR-25 AC-3 (task 42.2): the last run's count, as the artboard's *7/11* — not sortable, being a reading of a
        // run rather than a fact of the report a reader orders by.
        cell: (row) => <ReportCompletion validation={row.validation} />,
      },
      {
        key: REPORT_SORT.ACTIVITY,
        header: t('columns.activity'),
        sortable: true,
        // **The instant alone, without the artboard's "· Ana R."** — `GET /reports` answers no
        // actor, and who last touched a report is provenance (§6.13's chip, UX-68's history) that
        // reaches a screen only when a read answers it. Formatted through a named format, never a
        // pattern written here (NFR-26).
        cell: (row) => <span>{format.dateTime(new Date(row.updatedAt), 'short')}</span>,
      },
      {
        key: REPORT_COLUMN.PIN,
        header: t('columns.pin'),
        // DR-4 made visible, and this is task 32.3's deliverable: *"a report … **displays its
        // pinned versions**"*, plural. **Both**, because the first draft showed only the taxonomy
        // and left `templateVersion` on the row model and on no screen at all — half a deliverable
        // that reads as a whole one. They are separate facts: FR-69 migrates them independently, so
        // a reader checking one learns nothing about the other.
        //
        // No standing is claimed — nothing yet tells a screen a version has been superseded (task
        // 33.3 registers the second one that makes the question answerable), and `PeriodsList`
        // records the same restraint.
        cell: (row) => (
          <span className={styles.pins}>
            <VersionPinIndicator label={t('columns.template')} version={row.templateVersion} />
            <VersionPinIndicator label={t('columns.taxonomy')} version={row.taxonomyVersion} />
          </span>
        ),
      },
      // A filed row's *Download* (task 216) and the administrator's ⋯ (task 192): a column only where a row may have
      // something to offer in it.
      ...(canDelete || canDownload
        ? [
            {
              key: REPORT_COLUMN.ACTIONS,
              header: t('columns.actions'),
              size: COLUMN_SIZE.FIT,
              cell: (row: ReportRow) => <ReportRowActions row={row} canDownload={canDownload} canDelete={canDelete} />,
            },
          ]
        : []),
    ],
    [canDelete, canDownload, format, t],
  );

  return (
    <>
      <ListSearch value={view.q} label={t('searchLabel')} onSearchAction={(q) => setView({ q })} />
      <ReportsToolbar view={view} options={options} canCreate={canCreate} onViewChangeAction={setView} />

      <IndexView<ReportRow, ReportColumnKey>
        page={page}
        caption={t('caption')}
        columns={columns}
        rowKey={(row) => row.id}
        sort={{ column: view.sort, direction: view.direction }}
        onSortChange={(sort) =>
          setView({ sort: sort.column as ReportSort, direction: sort.direction })
        }
        onPageChange={(next) => setView({ page: next })}
        // UX-141's size, which resets the page as every other change of view does (task 203.1).
        onPageSizeChange={(size) => setView({ pageSize: toPageSize(size) })}
        empty={{
          firstUse: (
            // §4.6: an Index "always has an empty state that teaches", and teaching here means
            // saying what a report IS — one entity, one period — because that is the sentence the
            // artboard's own empty state leads with, and a member who has just been invited has no
            // reason to know it.
            <EmptyState
              title={t('empty.firstUse.title')}
              action={
                canCreate ? (
                  <Button asChild>
                    <Link href={ROUTES.REPORT_NEW}>{t('empty.firstUse.action')}</Link>
                  </Button>
                ) : null
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
                  onClick={() =>
                    setView({
                      status: REPORT_FILTER_ANY,
                      entity: REPORT_FILTER_ANY,
                      year: REPORT_FILTER_ANY,
                    })
                  }
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
