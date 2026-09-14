import { useQuery } from '@tanstack/react-query';
import { Navigate, useLocation } from '@tanstack/react-router';
import { REALM_READ } from '../../../../shared/tools/realm-read';
import { adminRosterQuery } from '../../../queries/admin-roster';
import type { AccountsSearch } from '../../../tools/accounts-search';
import { readRosterOutcome } from '../../../tools/roster-read';
import { RosterBoard } from '../board/roster-board';
import { RosterForbidden } from '../states/roster-forbidden';
import { RosterLoading } from '../states/roster-loading';
import { RosterUnavailable } from '../states/roster-unavailable';

/**
 * A-08's account region (task 67.4). **The section reads and picks the arm**: the roster, §5.2's
 * permission state for a Billing Operator, a sign-in for a session that ended, or a retry.
 *
 * **This region speaks for the whole screen's refusals** — the log below reads the same realm, and one
 * explanation of a boundary is enough.
 */
export function RosterSection({
  search,
  operatorId,
  onSearchChange,
}: {
  readonly search: AccountsSearch;
  readonly operatorId: string;
  readonly onSearchChange: (next: AccountsSearch) => void;
}) {
  const query = useQuery(adminRosterQuery());
  const href = useLocation({ select: (location) => location.href });

  if (query.data === undefined) {
    return query.isError ? <RosterUnavailable onRetry={() => void query.refetch()} /> : <RosterLoading />;
  }

  const read = readRosterOutcome(query.data);
  switch (read.kind) {
    case REALM_READ.SIGNED_OUT:
      return <Navigate to="/sign-in" search={{ redirect: href }} />;
    case REALM_READ.FORBIDDEN:
      return <RosterForbidden />;
    case REALM_READ.UNAVAILABLE:
      return <RosterUnavailable onRetry={() => void query.refetch()} />;
    case REALM_READ.READY:
      return (
        <RosterBoard
          rows={read.rows}
          search={search}
          operatorId={operatorId}
          onSearchChange={onSearchChange}
        />
      );
  }
}
