'use client';

import { Button, BUTTON_VARIANT, EmptyState, Select, StatusChip, TextLink } from '@easyesg/ui';
import type { DataTableColumn, StatusTone } from '@easyesg/ui';
import { useTranslations } from 'next-intl';
import { useCallback, useMemo, useTransition } from 'react';
import { IndexView } from '@/shared/index-view';
import { Link, useRouter } from '@/i18n/navigation';
import { ROUTES, entityRoute, withQuery } from '@/lib/routes';
import {
  ENTITY_FILTER_ANY,
  ENTITY_SORT,
  ENTITY_STANDING,
  ENTITY_STANDING_FILTERS,
  entityViewQuery,
  type EntityPage,
  type EntityRow,
  type EntitySort,
  type EntityStanding,
  type EntityView,
} from '../entities';
import styles from './entities.module.css';

/**
 * S-13's list, as an instance of the Index archetype (§4.6).
 *
 * Everything that is not about *this* screen is `IndexShell` and the app's `IndexView` binding —
 * the empty-state choice and its rule, the table-and-pager composition, and the seven chrome
 * strings every Index needs. What is left is what only S-13 knows: its columns, its caption, its
 * filter, and two empty states that teach something specific.
 *
 * **No context provider, unlike S-16.** That screen's rows act — a role change, a removal, a resend
 * — so its state is several values moving on named events and belongs in a reducer. Here a row
 * *navigates*, so the only state is the view, and the view lives in the address (UX-4). Adding a
 * provider for one value would be the ceremony the reducer rule explicitly excludes.
 */
/**
 * The columns that are not sort dimensions, declared rather than written into a union — the
 * convention's own reason applies: a hand-written union has no runtime value, so the key would be
 * spelled again at the column that uses it and a typo would silently produce a second column.
 */
const ENTITY_COLUMN = { ACTIVITY: 'activity' } as const;

export type EntityColumnKey = EntitySort | (typeof ENTITY_COLUMN)[keyof typeof ENTITY_COLUMN];

/** Active is positive; archived is neutral rather than an error — FR-20 makes it a deliberate,
 *  reversible-by-nobody state, not a fault the reader should be alarmed by. */
const STANDING_TONE: Record<EntityStanding, StatusTone> = {
  [ENTITY_STANDING.ACTIVE]: 'positive',
  [ENTITY_STANDING.ARCHIVED]: 'neutral',
};

export interface EntitiesListProps {
  readonly page: EntityPage;
  readonly view: EntityView;
  /** Legal-form key → its word, resolved by the page from the catalogue. */
  readonly legalForms: Readonly<Record<string, string>>;
}

export function EntitiesList({ page, view, legalForms }: EntitiesListProps) {
  const t = useTranslations('organization.entities');
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
        cell: (row) => (
          <span className={styles.identity}>
            {/* The row action is the name itself, which is what an Index row action should be when
                the record is the only destination: a separate "Open" column would be a second
                target for one intention. */}
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
        key: ENTITY_COLUMN.ACTIVITY,
        header: t('columns.activity'),
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
        align: 'end',
        cell: (row) => <span className="t-numeric">{row.siteCount}</span>,
      },
      {
        key: ENTITY_SORT.STANDING,
        header: t('columns.standing'),
        sortable: true,
        cell: (row) => (
          <StatusChip tone={STANDING_TONE[row.standing]}>{t(`standing.${row.standing}`)}</StatusChip>
        ),
      },
    ],
    [t, legalForms],
  );

  return (
    <>
      <div className={styles.filters}>
        <Select
          label={t('filter.standing')}
          value={view.standing}
          onValueChange={(next) =>
            setView({ standing: next as EntityView['standing'] })
          }
          options={ENTITY_STANDING_FILTERS.map((option) => ({
            value: option,
            label: t(`filter.options.${option}`),
          }))}
        />
      </div>

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
