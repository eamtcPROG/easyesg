'use client';

import {
  Button,
  BUTTON_VARIANT,
  COLUMN_ALIGN,
  COLUMN_SIZE,
  DEFAULT_PAGE_SIZE,
  EmptyState,
  readPageSize,
  STATUS_TONE,
  StatusChip,
  TextLink,
} from '@easyesg/ui';
import type { DataTableColumn, StatusTone } from '@easyesg/ui';
import { useTranslations } from 'next-intl';
import { useCallback, useMemo, useTransition } from 'react';
import { IndexView } from '@/shared/index-view';
import { ListSearch } from '@/shared/list-search';
import { Link, useRouter } from '@/i18n/navigation';
import { PERIODS_FROM } from '@/lib/periods-from';
import { ROUTES, entityPeriodsRoute, entityRoute, withQuery } from '@/lib/routes';
import {
  ENTITY_FILTER_ANY,
  ENTITY_SORT,
  ENTITY_STANDING,
  entityViewQuery,
  type EntityPage,
  type EntityRow,
  type EntitySort,
  type EntityStanding,
  type EntityView,
} from '../../tools/entities';
import { ENTITIES_MESSAGES } from '../shared/entity-messages';
import styles from '../styles/entities.module.css';
import { EntitiesToolbar } from './entities-toolbar';
import { EntityPeriodsCell } from './entity-periods-cell';

/**
 * S-13's list, as an instance of the Index archetype (§4.6).
 *
 * Everything that is not about *this* screen is `IndexShell` and the app's `IndexView` binding —
 * the empty-state choice and its rule, the table-and-pager composition, and the seven chrome
 * strings every Index needs. What is left is what only S-13 knows: its columns, its caption, its
 * filter row (`EntitiesToolbar`), and two empty states that teach something specific.
 *
 * **No context provider, unlike S-16.** That screen's rows act — a role change, a removal, a resend
 * — so its state is several values moving on named events and belongs in a reducer. Here a row
 * *navigates*, so the only state is the view, and the view lives in the address (UX-4). Adding a
 * provider for one value would be the ceremony the reducer rule explicitly excludes.
 *
 * **Every row ends in a labelled action** (29 Sep 2026, project owner: *"to be clear for the user how to edit it"*) —
 * *edit* for an active entity and *view* for an archived one, whose record is read-only; the console's row button
 * (§5.2), named for its row. The name stays a link as well: it is where a reader who already knows looks, and the
 * button is where one who does not is told. **The periods cell and its *periods* button are the same pair** (30 Sep
 * 2026, project owner), for the same reason.
 */
/**
 * The columns that are not sort dimensions, declared rather than written into a union — the
 * convention's own reason applies: a hand-written union has no runtime value, so the key would be
 * spelled again at the column that uses it and a typo would silently produce a second column.
 */
const ENTITY_COLUMN = { IDNO: 'idno', ACTIVITY: 'activity', PERIODS: 'periods', ACTIONS: 'actions' } as const;

export type EntityColumnKey = EntitySort | (typeof ENTITY_COLUMN)[keyof typeof ENTITY_COLUMN];

/** Active is positive; archived is neutral rather than an error — FR-20 makes it a deliberate,
 *  reversible-by-nobody state, not a fault the reader should be alarmed by. */
const STANDING_TONE: Record<EntityStanding, StatusTone> = {
  [ENTITY_STANDING.ACTIVE]: STATUS_TONE.POSITIVE,
  [ENTITY_STANDING.ARCHIVED]: STATUS_TONE.NEUTRAL,
};

export interface EntitiesListProps {
  readonly page: EntityPage;
  readonly view: EntityView;
  /** Legal-form key → its word, resolved by the page from the catalogue. */
  readonly legalForms: Readonly<Record<string, string>>;
}

export function EntitiesList({ page, view, legalForms }: EntitiesListProps) {
  const t = useTranslations(ENTITIES_MESSAGES);
  const router = useRouter();
  const [, startNavigation] = useTransition();

  const setView = useCallback(
    (next: Partial<EntityView>) => {
      // Any change to the filter or the sort resets the page: staying on page 3 of a list that has
      // just become one page long shows nothing and reads as "no matches", which is a different
      // screen. S-16 records the same rule at its own `setView`.
      const resetsPage = next.page === undefined;
      const query = entityViewQuery({ ...view, ...next, ...(resetsPage ? { page: 1 } : {}) });
      startNavigation(() => {
        router.push(withQuery(ROUTES.ENTITIES, query));
      });
    },
    [router, view],
  );

  const columns = useMemo<DataTableColumn<EntityRow, EntityColumnKey>[]>(
    () => [
      {
        key: ENTITY_SORT.NAME,
        header: t('columns.entity'),
        sortable: true,
        // The two text columns share the width equally, and the short ones take only what they hold
        // (29 Sep 2026, project owner: *"a better alignment of the columns for more symmetry"*).
        size: COLUMN_SIZE.FILL,
        cell: (row) => (
          <span className={styles.identity}>
            <TextLink asChild>
              <Link href={entityRoute(row.id)}>{row.name}</Link>
            </TextLink>
            {row.legalForm ? (
              <span className={`t-caption ${styles.sub}`}>
                {legalForms[row.legalForm] ?? row.legalForm}
              </span>
            ) : null}
          </span>
        ),
      },
      {
        // Beside the name, as the index artboard draws it: the IDNO is how an entity is told apart from a namesake, and
        // the entity's since task 175 (FR-16 as amended).
        key: ENTITY_COLUMN.IDNO,
        header: t('columns.idno'),
        size: COLUMN_SIZE.FIT,
        cell: (row) =>
          row.idno === null ? (
            // Said rather than left blank, for `unclassified`'s reason: task 40's rules will ask for one at filing.
            <span className={`t-caption ${styles.sub}`}>{t('columns.idnoMissing')}</span>
          ) : (
            <span className={styles.idno} translate="no">
              {row.idno}
            </span>
          ),
      },
      {
        key: ENTITY_COLUMN.ACTIVITY,
        header: t('columns.activity'),
        size: COLUMN_SIZE.FILL,
        cell: (row) =>
          row.activity.length > 0 ? (
            <span className={styles.activity}>{row.activity.join(' · ')}</span>
          ) : (
            // Not an empty cell: an unclassified entity is a state FR-17 permits and task 40's
            // rules will refuse at filing time, so the row says so rather than looking like a
            // rendering failure.
            <span className={`t-caption ${styles.sub}`}>{t('columns.unclassified')}</span>
          ),
      },
      {
        key: ENTITY_SORT.SITES,
        header: t('columns.sites'),
        sortable: true,
        // Centred: a site count is a digit or two under a wider header, so there is no column of
        // magnitudes for end alignment to line up.
        align: COLUMN_ALIGN.CENTER,
        size: COLUMN_SIZE.FIT,
        cell: (row) => <span className="t-numeric">{row.siteCount}</span>,
      },
      {
        // The way into S-14 for the row's entity, and one of the short columns: two years and their standing at most.
        key: ENTITY_COLUMN.PERIODS,
        header: t('columns.periods'),
        size: COLUMN_SIZE.FIT,
        cell: (row) => <EntityPeriodsCell row={row} />,
      },
      {
        key: ENTITY_SORT.STANDING,
        header: t('columns.standing'),
        sortable: true,
        align: COLUMN_ALIGN.CENTER,
        size: COLUMN_SIZE.FIT,
        cell: (row) => (
          <StatusChip tone={STANDING_TONE[row.standing]}>{t(`standing.${row.standing}`)}</StatusChip>
        ),
      },
      {
        key: ENTITY_COLUMN.ACTIONS,
        header: t('columns.actions'),
        align: COLUMN_ALIGN.END,
        size: COLUMN_SIZE.FIT,
        cell: (row) => {
          // An archived record takes no change (FR-20), so its button says it opens to be read.
          const edits = row.standing === ENTITY_STANDING.ACTIVE;
          return (
            <span className={styles.rowActions}>
              {/* 30 Sep 2026, project owner: the periods cell is a link, and a reader may not know to press it — so
                  the row says where its periods are too, as it says how to edit. Archived included: its periods stay. */}
              <Button asChild variant={BUTTON_VARIANT.SECONDARY}>
                <Link
                  href={entityPeriodsRoute(row.id, PERIODS_FROM.ENTITIES)}
                  aria-label={t('rowActions.periodsNamed', { name: row.name })}
                >
                  {t('rowActions.periods')}
                </Link>
              </Button>
              <Button asChild variant={BUTTON_VARIANT.SECONDARY}>
                <Link
                  href={entityRoute(row.id)}
                  // The visible word, and a name that begins with it (WCAG 2.5.3) and ends with the row.
                  aria-label={
                    edits ? t('rowActions.editNamed', { name: row.name }) : t('rowActions.viewNamed', { name: row.name })
                  }
                >
                  {edits ? t('rowActions.edit') : t('rowActions.view')}
                </Link>
              </Button>
            </span>
          );
        },
      },
    ],
    [t, legalForms],
  );

  return (
    <>
      <ListSearch value={view.q} label={t('searchLabel')} onSearchAction={(q) => setView({ q })} />
      <EntitiesToolbar
        standing={view.standing}
        onStandingChangeAction={(standing) => setView({ standing })}
      />

      <IndexView<EntityRow, EntityColumnKey>
        page={page}
        caption={t('caption')}
        columns={columns}
        rowKey={(row) => row.id}
        sort={{ column: view.sort, direction: view.direction }}
        onSortChange={(sort) =>
          setView({ sort: sort.column as EntitySort, direction: sort.direction })
        }
        onPageChange={(next) => setView({ page: next })}
        // UX-141's size, which resets the page as every other change of view does (task 203.1).
        onPageSizeChange={(size) => setView({ pageSize: readPageSize(size).onpage ?? DEFAULT_PAGE_SIZE })}
        empty={{
          firstUse: (
            // §4.6: an Index "always has an empty state that teaches", and teaching means naming
            // the object and offering the one action that creates it.
            <EmptyState
              title={t('empty.firstUse.title')}
              action={
                <Button asChild>
                  <Link href={ROUTES.ENTITY_NEW}>{t('empty.firstUse.action')}</Link>
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
                  onClick={() => setView({ standing: ENTITY_FILTER_ANY })}
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
