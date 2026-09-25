import { useMutation, useQueryClient } from '@tanstack/react-query';
import { API_OUTCOME, type AdminRosterRow } from '@easyesg/contracts';
import { Button } from '@easyesg/ui';
import { useCallback, useId, useReducer } from 'react';
import { useTranslations } from 'use-intl';
import { runAccountControl } from '../../../queries/account-actions';
import { ADMIN_ROSTER_QUERY_KEY } from '../../../queries/admin-roster';
import { SYSTEM_AUDIT_LOG_QUERY_KEY } from '../../../queries/system-audit-log';
import {
  ACCOUNT_ACTION_EVENT,
  INITIAL_ACCOUNT_ACTION_STATE,
  accountActionReducer,
  type AccountAction,
} from '../../../tools/account-action-state';
import { controlDisclosesConsequence } from '../../../tools/account-controls';
import {
  ACCOUNTS_PANEL,
  withInvitePanel,
  withSelected,
  type AccountsSearch,
} from '../../../tools/accounts-search';
import { rosterTallyOf } from '../../../tools/roster-tally';
import { AccountConfirmation } from '../confirm/account-confirmation';
import { InviteForm } from '../invite/invite-form';
import { RosterList } from '../list/roster-list';
import { AccountNotice } from '../notice/account-notice';
import { AccountRecord } from '../record/account-record';

/**
 * A-08's account table, ready (task 67.4) — the header with its invitation control, the notice, the
 * table, the record or the invitation form, and the confirmation a suspension or removal asks for
 * (UX-70).
 *
 * **The table keeps the full width since task 170** (`design_spec.md` §5.2's preamble): the record and
 * the invitation form open in a dialogue over it, mounted while the address names one, and a row's own
 * controls sit in its last column, each taking the same `request` the record's buttons take — so a
 * suspension asks its question whether it began in the menu or in the record, and opens that question
 * over whichever is showing.
 *
 * **The notice follows the operator's eye**: inside the open dialogue, which covers the page, and above
 * the table otherwise — one element, placed in one of the two.
 *
 * **Every action invalidates the roster and the log together**: the state column moves, and the log
 * gains the row `AuditInterceptor` wrote for it, so an operator sees what they did in both places
 * without a reload.
 */
export function RosterBoard({
  rows,
  search,
  operatorId,
  onSearchChange,
}: {
  readonly rows: readonly AdminRosterRow[];
  readonly search: AccountsSearch;
  readonly operatorId: string;
  readonly onSearchChange: (next: AccountsSearch) => void;
}) {
  const t = useTranslations('platform.accounts');
  const titleId = useId();
  const queryClient = useQueryClient();
  const [state, dispatch] = useReducer(accountActionReducer, INITIAL_ACCOUNT_ACTION_STATE);
  const { mutate: run } = useMutation({ mutationFn: runAccountControl });

  const settle = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ADMIN_ROSTER_QUERY_KEY }),
      queryClient.invalidateQueries({ queryKey: SYSTEM_AUDIT_LOG_QUERY_KEY }),
    ]);
  }, [queryClient]);

  const perform = useCallback(
    (action: AccountAction) => {
      dispatch({ type: ACCOUNT_ACTION_EVENT.STARTED, action });
      run(
        { control: action.control, rowId: action.rowId },
        {
          onSuccess: (outcome) => {
            dispatch(
              outcome.status === API_OUTCOME.Ok
                ? { type: ACCOUNT_ACTION_EVENT.SUCCEEDED }
                : { type: ACCOUNT_ACTION_EVENT.REFUSED, failure: outcome },
            );
            void settle();
          },
        },
      );
    },
    [run, settle],
  );

  // Stable, because the record's buttons and every row's menu are rebuilt from it — and `reactCompiler`
  // is off (AD-9).
  const request = useCallback(
    (action: AccountAction) => {
      if (controlDisclosesConsequence(action.control)) {
        dispatch({ type: ACCOUNT_ACTION_EVENT.CONFIRMATION_REQUESTED, action });
      } else {
        perform(action);
      }
    },
    [perform],
  );

  const onOpen = useCallback(
    (id: string) => onSearchChange(withSelected(search, id)),
    [onSearchChange, search],
  );

  const inviting = search.panel === ACCOUNTS_PANEL.INVITE;
  const selected = inviting
    ? null
    : (rows.find((row) => row.id === search.selected) ?? null);
  const tally = rosterTallyOf(rows);

  const notice = (
    <AccountNotice
      notice={state.notice}
      onDismiss={() => dispatch({ type: ACCOUNT_ACTION_EVENT.NOTICE_DISMISSED })}
    />
  );

  return (
    <section aria-labelledby={titleId} className="flex min-w-0 flex-col gap-[var(--space-5)]">
      <header className="flex flex-wrap items-start justify-between gap-[var(--space-4)]">
        <div className="flex flex-col gap-[var(--space-2)]">
          <h1 id={titleId} className="t-heading-1">
            {t('title')}
          </h1>
          <p className="t-body text-[var(--text-muted)]">{t('lede')}</p>
          <p className="t-caption text-[var(--text-muted)]">{t('summary', { accounts: tally.accounts })}</p>
        </div>
        <Button type="button" onClick={() => onSearchChange(withInvitePanel(search, true))}>
          {t('invite')}
        </Button>
      </header>

      {inviting || selected !== null ? null : notice}

      <RosterList
        rows={rows}
        tally={tally}
        operatorId={operatorId}
        busy={state.pending !== null}
        onOpen={onOpen}
        onControl={request}
      />

      {inviting ? (
        <InviteForm
          notice={notice}
          onSent={(email) => {
            dispatch({ type: ACCOUNT_ACTION_EVENT.INVITATION_SENT, email });
            onSearchChange(withInvitePanel(search, false));
            void settle();
          }}
          onCancel={() => onSearchChange(withInvitePanel(search, false))}
        />
      ) : null}
      {selected === null ? null : (
        <AccountRecord
          row={selected}
          operatorId={operatorId}
          pending={state.pending}
          notice={notice}
          onControl={request}
          onClose={() => onSearchChange(withSelected(search, null))}
        />
      )}

      <AccountConfirmation
        action={state.confirming}
        busy={state.pending !== null}
        onConfirm={() => {
          if (state.confirming !== null) perform(state.confirming);
        }}
        onCancel={() => dispatch({ type: ACCOUNT_ACTION_EVENT.CONFIRMATION_CANCELLED })}
      />
    </section>
  );
}
