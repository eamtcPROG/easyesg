'use client';

import {
  BUTTON_VARIANT,
  Button,
  EmptyState,
  Select,
  StatusChip,
  TextLink,
  VersionPinIndicator,
} from '@easyesg/ui';
import { STATUS_TONE as STATUS_TONE_VALUES } from '@easyesg/ui';
import type { DataTableColumn, StatusTone } from '@easyesg/ui';
import { REPORT_STATUS, type ReportStatus } from '@easyesg/contracts';
import { useFormatter, useTranslations } from 'next-intl';
import { useCallback, useMemo, useTransition } from 'react';
import { IndexView } from '@/shared/index-view';
import { Link, useRouter } from '@/i18n/navigation';
import { ROUTES, reportRoute, withQuery } from '@/lib/routes';
import {
  REPORT_FILTER_ANY,
  REPORT_SORT,
  REPORT_STATUS_FILTERS,
  reportViewQuery,
  type ReportPage,
  type ReportRow,
  type ReportSort,
  type ReportView,
} from '../reports';
import styles from './reports.module.css';

/**
 * S-06's list, as an instance of the Index archetype (§4.6) — UC-17, FR-25.
 *
 * `PeriodsList`'s shape: everything that is not about *this* screen is `IndexShell` and the app's
 * `IndexView` binding, a row navigates rather than acts, and the only state is the view, which
 * lives in the address (UX-4). No provider and no reducer for values nothing else moves with.
 *
 * **The row action is a link into the wizard, and it is one action rather than the artboard's
 * four.** The artboard draws *Continue · Open · Preview · Download* by state; preview is S-11
 * (task 43) and download is the export re-fetch (task 47), and neither screen exists — a control
 * that cannot act is worse than an absent one, which is task 30.1's rule and the reason task 32.2.2
 * was blocked at all until S-07 became real. What every row can do today is open, so that is what
 * every row offers.
 */

/** Columns that are not sort dimensions, declared rather than written as a union — the
 *  convention's own reason: a hand-written union has no runtime value, so a typo makes a second
 *  column instead of failing. */
const REPORT_COLUMN = { PERIOD: 'period', PIN: 'pin' } as const;

export type ReportColumnKey = ReportSort | (typeof REPORT_COLUMN)[keyof typeof REPORT_COLUMN];

/**
 * The tone says **what this row asks of the reader**, which is `StatusTone`'s own vocabulary read
 * literally rather than a severity scale.
 *
 * `open` is *neutral* — the ordinary state of most rows, and the one the label already names.
 * `ready_to_file` is *pending*: the work here is done and what resolves it is an act outside this
 * screen (task 47's export, then the filing itself), which is exactly what that member means.
 * `filed` is *positive* — settled and good, the end the whole product is for. `locked` is *neutral*
 * for `PeriodsList`'s stated reason: locking is a deliberate act that gives the change history a
 * defensible endpoint, and an alarming tone would tell a reader who did the right thing that they
 * had erred. Two rows share *neutral* and are told apart by their labels, which is UX-102 working
 * as intended — colour is never the sole carrier.
 *
 * Exhaustive by `Record`: a fifth status added to the contract fails here rather than rendering a
 * row with no chip.
 */
const STATUS_TONE: Record<ReportStatus, StatusTone> = {
  [REPORT_STATUS.OPEN]: STATUS_TONE_VALUES.NEUTRAL,
  [REPORT_STATUS.READY_TO_FILE]: STATUS_TONE_VALUES.PENDING,
  [REPORT_STATUS.LOCKED]: STATUS_TONE_VALUES.NEUTRAL,
  [REPORT_STATUS.FILED]: STATUS_TONE_VALUES.POSITIVE,
};

export interface ReportsListProps {
  readonly page: ReportPage;
  readonly view: ReportView;
  readonly entities: readonly { readonly id: string; readonly name: string }[];
  readonly years: readonly number[];
  /**
   * FR-25's view-only clause: *"a view-only member sees the same entries and no edit affordances"*.
   * The rows are unchanged; the teaching empty state loses its action, because creating a report is
   * the one write this screen offers and a viewer's would be refused.
   */
  readonly canCreate: boolean;
}

export function ReportsList({ page, view, entities, years, canCreate }: ReportsListProps) {
  const t = useTranslations('organization.reports');
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
        cell: (row) => (
          <StatusChip tone={STATUS_TONE[row.status]}>{t(`status.${row.status}`)}</StatusChip>
        ),
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
    ],
    [format, t],
  );

  return (
    <>
      <div className={styles.filters}>
        <Select
          label={t('filter.entity')}
          value={view.entity}
          onValueChange={(next) => setView({ entity: next })}
          options={[
            { value: REPORT_FILTER_ANY, label: t('filter.options.anyEntity') },
            ...entities.map((entity) => ({ value: entity.id, label: entity.name })),
          ]}
        />
        <Select
          label={t('filter.year')}
          value={view.year}
          onValueChange={(next) => setView({ year: next })}
          options={[
            { value: REPORT_FILTER_ANY, label: t('filter.options.anyYear') },
            ...years.map((year) => ({ value: String(year), label: String(year) })),
          ]}
        />
        <Select
          label={t('filter.status')}
          value={view.status}
          onValueChange={(next) => setView({ status: next as ReportView['status'] })}
          options={REPORT_STATUS_FILTERS.map((option) => ({
            value: option,
            label: t(`filter.options.${option}`),
          }))}
        />
      </div>

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
