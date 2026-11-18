import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ADMIN_PERMISSION,
  ADMIN_ROLE,
  ADMIN_ROSTER_KIND,
  ADMIN_STANDING,
  API_OUTCOME,
  type AdminRosterRow,
} from '@easyesg/contracts';
import { Button, useDismissible } from '@easyesg/ui';
import { useReducer } from 'react';
import { useTranslations } from 'use-intl';
import { ExpiringRefusal } from '~/realm/components/shared/expiring-refusal';
import { adminSessionQuery } from '~/realm/queries/session';
import { changeConsoleRoles } from '../../../queries/account-actions';
import { ADMIN_ROSTER_QUERY_KEY } from '../../../queries/admin-roster';
import { SYSTEM_AUDIT_LOG_QUERY_KEY } from '../../../queries/system-audit-log';
import { CONSOLE_ROLE_LABEL } from '../../../tools/console-role-labels';
import {
  ROLE_DRAFT_EVENT,
  ROLE_DRAFT_OUTCOME,
  roleDraftReducer,
} from '../../../tools/role-draft-state';
import { ConsoleRolesChoice } from '../shared/console-roles-choice';

/**
 * The console roles an account holds, in its record (task 67.13; FR-80 behaviour 10, AC-9; §12.5.6's task-67.13 row) —
 * read by everyone who opens the record, and changed here by an administrator whose roles let them assign, for another
 * Platform Administrator's account that is not removed. **One's own roles are read-only**: another administrator
 * changes them, which the api refuses otherwise anyway. A Billing Operator holds none, the realm being its authority.
 *
 * The choice and the last save's outcome are one reducer (`role-draft-state.ts`): changing the choice clears a
 * *saved* notice, which as two `useState`s would have stood over a choice it never saved.
 */
export function AccountRoles({ row, operatorId }: { readonly row: AdminRosterRow; readonly operatorId: string }) {
  const t = useTranslations('platform.accounts.consoleRoles');
  const queryClient = useQueryClient();
  const { data: operator } = useQuery(adminSessionQuery);
  const [state, dispatch] = useReducer(roleDraftReducer, { roles: row.consoleRoles, outcome: null });
  const draft = state.roles;
  const failure = state.outcome?.kind === ROLE_DRAFT_OUTCOME.REFUSED ? state.outcome.failure : null;
  const [shownFailure, dismissFailure] = useDismissible(failure);

  const { mutate: save, isPending } = useMutation({
    mutationFn: changeConsoleRoles,
    onSuccess: async (outcome) => {
      if (outcome.status !== API_OUTCOME.Ok) {
        dispatch({ type: ROLE_DRAFT_EVENT.REFUSED, failure: outcome });
        return;
      }
      dispatch({ type: ROLE_DRAFT_EVENT.SAVED });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ADMIN_ROSTER_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: SYSTEM_AUDIT_LOG_QUERY_KEY }),
      ]);
    },
  });

  if (row.role !== ADMIN_ROLE.PLATFORM_ADMINISTRATOR) {
    return <p className="t-caption text-[var(--text-muted)]">{t('notForBilling')}</p>;
  }

  const editable =
    row.kind === ADMIN_ROSTER_KIND.ACCOUNT &&
    row.standing !== ADMIN_STANDING.REMOVED &&
    row.id !== operatorId &&
    (operator?.permissions.includes(ADMIN_PERMISSION.ACCOUNT_ROLES_ASSIGN) ?? false);

  if (!editable) {
    return (
      <section aria-labelledby={`roles-${row.id}`} className="flex flex-col gap-[var(--space-2)]">
        <h3 id={`roles-${row.id}`} className="t-label">
          {t('heading')}
        </h3>
        <ul className="t-body flex flex-col gap-[var(--space-1)]">
          {row.consoleRoles.map((role) => (
            <li key={role}>{t(`roles.${CONSOLE_ROLE_LABEL[role]}.name`)}</li>
          ))}
        </ul>
        {row.id === operatorId ? <p className="t-caption text-[var(--text-muted)]">{t('ownNote')}</p> : null}
      </section>
    );
  }

  const empty = draft.length === 0;
  return (
    <form
      method="post"
      noValidate
      className="flex flex-col gap-[var(--space-3)]"
      onSubmit={(event) => {
        event.preventDefault();
        if (empty) return;
        dispatch({ type: ROLE_DRAFT_EVENT.SUBMITTED });
        save({ accountId: row.id, roles: draft });
      }}
    >
      <ConsoleRolesChoice
        value={draft}
        onChange={(roles) => dispatch({ type: ROLE_DRAFT_EVENT.CHOSEN, roles })}
        error={empty ? t('noneChosen') : undefined}
        disabled={isPending}
      />
      <div>
        <Button type="submit" busy={isPending} disabled={empty}>
          {t('save')}
        </Button>
      </div>
      {state.outcome?.kind === ROLE_DRAFT_OUTCOME.SAVED ? (
        <p role="status" className="t-caption text-[var(--text-muted)]">
          {t('saved')}
        </p>
      ) : null}
      {shownFailure === null ? null : (
        <ExpiringRefusal
          failure={shownFailure}
          title={t('problemTitle')}
          fallback={t('problemBody')}
          onDismiss={dismissFailure}
        />
      )}
    </form>
  );
}
