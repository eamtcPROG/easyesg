'use client';

import {
  Button,
  Callout,
  ConsequenceDialogue,
  DataTable,
  EmptyState,
  Pagination,
  Select,
  StatusChip,
  CALLOUT_INTENT,
  type CalloutIntent,
  type DataTableColumn,
  type StatusTone,
} from '@easyesg/ui';
import { useFormatter, useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import type { MembershipRole } from '@easyesg/contracts';
import { MEMBERSHIP_ROLE } from '@easyesg/contracts';
import { API_OUTCOME } from '@/lib/api-outcome';
import { useRouter } from '@/i18n/navigation';
import {
  ACCESS_FILTER_ANY,
  ACCESS_PAGE_SIZE,
  ACCESS_ROW_KIND,
  ACCESS_SORT,
  ACCESS_STANDING,
  accessStanding,
  accessViewQuery,
  isLastAdministrator,
  type AccessPage,
  type AccessRow,
  type AccessSort,
  type AccessStanding,
  type AccessView,
} from '../access';
import {
  changeMemberRoleAction,
  removeMemberAction,
  resendInvitationAction,
  revokeInvitationAction,
} from '../actions';
import type { AccessActionResult } from '../types/action-results';
import styles from './access.module.css';

/**
 * S-16's Index body — the filter, the sort, the table, the row actions and the pager (§4.6).
 *
 * **The server does the work; this changes the address.** Filtering, sorting and paging all happen
 * in the read model on the server, from `searchParams`; every control here writes the URL and lets
 * the page re-render. That is UX-4 taken literally — every addressable state is in the URL, so a
 * filtered list can be linked, bookmarked and reloaded — and it is why this island holds no copy of
 * the rows and no derived state to keep in step with them.
 *
 * **Row actions differ by kind, not by a flag.** A member's role can be changed and their access
 * withdrawn; an invitation can be resent or revoked. They are different verbs on different objects
 * that happen to share a list, which is what the `AccessRow` union says and what the switch below
 * reads. A single "actions" menu parameterised by booleans would have been the shape UX-89 warns
 * about — and would have had to decide what "change role" means for someone who has not accepted.
 */

/** Which confirmation the dialogue is currently asking for. Both are consequence-disclosing. */
const CONFIRMATION = {
  /** UC-63 — withdraw a member's access. */
  REMOVE: 'remove',
  /** UC-61 — withdraw an outstanding invitation. */
  REVOKE: 'revoke',
} as const;

type ConfirmationKind = (typeof CONFIRMATION)[keyof typeof CONFIRMATION];

const STANDING_TONE: Record<AccessStanding, StatusTone> = {
  [ACCESS_STANDING.ACTIVE]: 'positive',
  [ACCESS_STANDING.INVITED]: 'pending',
  [ACCESS_STANDING.INVITATION_EXPIRED]: 'attention',
};

/**
 * The table's columns: every sortable one, plus the row-action column that is not.
 *
 * Spread from `ACCESS_SORT` rather than restated, so a new sort dimension becomes a column with no
 * edit here — and so the two cannot disagree about how a column is spelled, which is what the
 * `sort=` parameter and the header both read.
 */
const ACCESS_COLUMN = { ...ACCESS_SORT, ACTIONS: 'actions' } as const;

type ColumnKey = (typeof ACCESS_COLUMN)[keyof typeof ACCESS_COLUMN];

/**
 * A completed action, reported beside the list.
 *
 * All three parts NFR-79 requires, `action` included — the slot is required by `Callout` for
 * exactly the reason this screen first got wrong: filled with a control's label ("Actions") it
 * reads as decoration, and the reader is left without the one sentence that says what to do next.
 * On a success that sentence is honestly "nothing"; saying so is not the same as omitting it.
 */
interface Notice {
  readonly intent: CalloutIntent;
  readonly title: string;
  readonly body: string;
  readonly action: string;
}

export function AccessBoard({
  page,
  view,
  now,
  inviteAnchorId,
}: {
  readonly page: AccessPage;
  readonly view: AccessView;
  /** The server's clock, so the standing a row shows is the one the server filtered on. */
  readonly now: number;
  /** Where "invite a colleague" sends a reader from the first-use empty state. */
  readonly inviteAnchorId: string;
}) {
  const t = useTranslations('organization.access');
  const tCommon = useTranslations('identity');
  const format = useFormatter();
  const router = useRouter();
  const [navigating, startNavigation] = useTransition();
  const [acting, startAction] = useTransition();
  const [notice, setNotice] = useState<Notice | null>(null);
  const [confirming, setConfirming] = useState<{
    readonly kind: ConfirmationKind;
    readonly row: AccessRow;
  } | null>(null);

  const go = (next: Partial<AccessView>) => {
    // Any change to the filter or the sort resets the page: staying on page 3 of a list that just
    // became one page long shows nothing and reads as "no matches", which is a different screen.
    const resetsPage = next.page === undefined;
    const query = accessViewQuery({ ...view, ...next, ...(resetsPage ? { page: 1 } : {}) });
    startNavigation(() => {
      router.push(`/organization/users${query ? `?${query}` : ''}`);
    });
  };

  const run = (action: () => Promise<AccessActionResult>, success: string) => {
    startAction(async () => {
      const outcome = await action();
      setConfirming(null);
      if (outcome.status === API_OUTCOME.Ok) {
        setNotice({
          intent: CALLOUT_INTENT.SUCCESS,
          title: success,
          body: t('notice.body'),
          action: t('notice.action'),
        });
        return;
      }
      setNotice({
        intent: CALLOUT_INTENT.ERROR,
        title:
          outcome.status === API_OUTCOME.Problem
            ? (outcome.problem.title ?? tCommon('unreachable.title'))
            : tCommon('unreachable.title'),
        body:
          outcome.status === API_OUTCOME.Problem
            ? (outcome.problem.detail ?? tCommon('unreachable.body'))
            : tCommon('unreachable.body'),
        action: t('notice.failedAction'),
      });
    });
  };

  const columns: readonly DataTableColumn<AccessRow, ColumnKey>[] = [
    {
      key: ACCESS_SORT.PERSON,
      header: t('columns.person'),
      sortable: true,
      cell: (row) => row.email,
    },
    {
      key: ACCESS_SORT.ROLE,
      header: t('columns.role'),
      sortable: true,
      cell: (row) => <RoleCell row={row} rows={page.rows} busy={acting} onChange={run} />,
    },
    {
      key: ACCESS_SORT.STANDING,
      header: t('columns.standing'),
      sortable: true,
      cell: (row) => {
        const standing = accessStanding(row, now);
        return <StatusChip tone={STANDING_TONE[standing]}>{t(`standings.${standing}`)}</StatusChip>;
      },
    },
    {
      key: ACCESS_SORT.ACTIVITY,
      header: t('columns.activity'),
      sortable: true,
      cell: (row) => {
        if (row.kind === ACCESS_ROW_KIND.MEMBER) {
          return row.lastActiveAt === null
            ? t('activity.never')
            : t('activity.lastActive', { date: format.dateTime(row.lastActiveAt, 'short') });
        }
        return accessStanding(row, now) === ACCESS_STANDING.INVITATION_EXPIRED
          ? t('activity.expiredOn', { date: format.dateTime(row.expiresAt, 'short') })
          : t('activity.invited', { date: format.dateTime(row.issuedAt, 'short') });
      },
    },
    {
      key: ACCESS_COLUMN.ACTIONS,
      header: t('columns.actions'),
      cell: (row) => (
        <RowActions
          row={row}
          rows={page.rows}
          busy={acting}
          onConfirm={(kind) => setConfirming({ kind, row })}
          onResend={() =>
            run(
              () => resendInvitationAction({ invitationId: row.id }),
              t('resent', { email: row.email }),
            )
          }
        />
      ),
    },
  ];

  return (
    <div className={styles.board} aria-busy={navigating}>
      {notice ? (
        <Callout intent={notice.intent} title={notice.title} action={notice.action}>
          {notice.body}
        </Callout>
      ) : null}

      <div className={styles.filters}>
        <Select
          label={t('filters.role')}
          value={view.role}
          onValueChange={(role) => go({ role: role as AccessView['role'] })}
          options={[
            { value: ACCESS_FILTER_ANY, label: t('filters.anyRole') },
            ...Object.values(MEMBERSHIP_ROLE).map((role) => ({
              value: role,
              label: t(`roles.${role}`),
            })),
          ]}
        />
        <Select
          label={t('filters.standing')}
          value={view.standing}
          onValueChange={(standing) => go({ standing: standing as AccessView['standing'] })}
          options={[
            { value: ACCESS_FILTER_ANY, label: t('filters.anyStanding') },
            ...Object.values(ACCESS_STANDING).map((standing) => ({
              value: standing,
              label: t(`standings.${standing}`),
            })),
          ]}
        />
      </div>

      {page.matched === 0 ? (
        <EmptyState
          title={page.total === 0 ? t('empty.firstUse.title') : t('empty.filtered.title')}
          action={
            page.total === 0 ? (
              <Button asChild>
                <a href={`#${inviteAnchorId}`}>{t('empty.firstUse.action')}</a>
              </Button>
            ) : (
              <Button
                variant="subtle"
                onClick={() => go({ role: ACCESS_FILTER_ANY, standing: ACCESS_FILTER_ANY })}
              >
                {t('empty.filtered.action')}
              </Button>
            )
          }
        >
          {page.total === 0 ? t('empty.firstUse.body') : t('empty.filtered.body')}
        </EmptyState>
      ) : (
        <>
          <DataTable
            caption={t('caption')}
            columns={columns}
            rows={page.rows}
            rowKey={(row) => `${row.kind}:${row.id}`}
            sort={{ column: view.sort, direction: view.direction }}
            onSortChange={(sort) =>
              go({ sort: sort.column as AccessSort, direction: sort.direction })
            }
            sortLabels={{
              sortBy: (column) => t('sort.sortBy', { column }),
              ascending: t('sort.ascending'),
              descending: t('sort.descending'),
            }}
          />
          <Pagination
            page={page.page}
            pageSize={ACCESS_PAGE_SIZE}
            total={page.matched}
            onPageChange={(next) => go({ page: next })}
            labels={{
              region: t('pagination.region'),
              previous: t('pagination.previous'),
              next: t('pagination.next'),
              position: (of) => t('pagination.position', of),
            }}
          />
        </>
      )}

      {confirming ? (
        <ConsequenceDialogue
          open
          title={t(`${confirming.kind}.title`)}
          object={confirming.row.email}
          consequence={t(`${confirming.kind}.consequence`)}
          retained={
            confirming.kind === CONFIRMATION.REMOVE ? t('remove.retained') : undefined
          }
          confirmLabel={t(`${confirming.kind}.confirm`)}
          cancelLabel={t(`${confirming.kind}.cancel`)}
          busy={acting}
          onCancel={() => setConfirming(null)}
          onConfirm={() => {
            const { kind, row } = confirming;
            run(
              () =>
                kind === CONFIRMATION.REMOVE
                  ? removeMemberAction({ membershipId: row.id })
                  : revokeInvitationAction({ invitationId: row.id }),
              t(`${kind}.done`, { email: row.email }),
            );
          }}
        />
      ) : null}
    </div>
  );
}

/**
 * A member's role is editable in place; an invitation's is not.
 *
 * An invitation's role is a promise already made to someone by email — changing it silently would
 * mean the link they hold grants something other than what they were told. UC-61 gives the
 * administrator revoke and re-invite, which is the honest way to change that promise.
 */
function RoleCell({
  row,
  rows,
  busy,
  onChange,
}: {
  readonly row: AccessRow;
  readonly rows: readonly AccessRow[];
  readonly busy: boolean;
  readonly onChange: (action: () => Promise<AccessActionResult>, success: string) => void;
}) {
  const t = useTranslations('organization.access');
  const tRoles = useTranslations('organization.access.roles');

  if (row.kind === ACCESS_ROW_KIND.INVITATION) return <>{tRoles(row.role)}</>;

  // FR-60: the last administrator cannot be demoted. The API refuses it and stays authoritative —
  // this only avoids OFFERING the action, and states why rather than showing a dead control.
  const locked = isLastAdministrator({ rows, row });

  return (
    <Select
      label={t('actions.changeRole', { email: row.email })}
      labelHidden
      value={row.role}
      disabled={busy || locked}
      help={locked ? t('actions.lastAdministrator') : undefined}
      onValueChange={(chosen) => {
        // `onValueChange` hands back the raw option value; narrowing once here keeps the cast off
        // both the request and the message, where two casts could disagree about the same value.
        const role = chosen as MembershipRole;
        onChange(
          () => changeMemberRoleAction({ membershipId: row.id, role }),
          t('roleChanged', { email: row.email, role: tRoles(role) }),
        );
      }}
      options={Object.values(MEMBERSHIP_ROLE).map((role) => ({
        value: role,
        label: tRoles(role),
      }))}
    />
  );
}

function RowActions({
  row,
  rows,
  busy,
  onConfirm,
  onResend,
}: {
  readonly row: AccessRow;
  readonly rows: readonly AccessRow[];
  readonly busy: boolean;
  readonly onConfirm: (kind: ConfirmationKind) => void;
  readonly onResend: () => void;
}) {
  const t = useTranslations('organization.access.actions');

  if (row.kind === ACCESS_ROW_KIND.INVITATION) {
    return (
      <div className={styles.rowActions}>
        <Button variant="subtle" disabled={busy} onClick={onResend}>
          {t('resend')}
        </Button>
        <Button variant="subtle" disabled={busy} onClick={() => onConfirm(CONFIRMATION.REVOKE)}>
          {t('revoke')}
        </Button>
      </div>
    );
  }

  const locked = isLastAdministrator({ rows, row });

  return (
    <div className={styles.rowActions}>
      <Button
        variant="destructive"
        disabled={busy || locked}
        onClick={() => onConfirm(CONFIRMATION.REMOVE)}
      >
        {t('remove')}
      </Button>
    </div>
  );
}
