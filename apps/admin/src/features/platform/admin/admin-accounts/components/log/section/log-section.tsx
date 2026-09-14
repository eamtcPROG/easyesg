import { useQuery } from '@tanstack/react-query';
import { ADMIN_ROSTER_KIND } from '@easyesg/contracts';
import { REALM_READ } from '~/realm/tools/realm-read';
import { adminRosterQuery } from '../../../queries/admin-roster';
import { systemAuditLogQuery } from '../../../queries/system-audit-log';
import { logViewOf, type AccountsSearch } from '../../../tools/accounts-search';
import { readLogOutcome } from '../../../tools/log-read';
import { readRosterOutcome } from '../../../tools/roster-read';
import { LogBoard } from '../board/log-board';
import { LogLoading } from '../states/log-loading';
import { LogUnavailable } from '../states/log-unavailable';

/**
 * A-08's log region (task 67.4; UC-88). **The section reads and picks the arm** — and it reads the
 * roster too, from the same cache the account region filled, because the operator filter offers the
 * accounts that could have acted.
 *
 * **A session that ended and a refused role draw nothing here**: the account region above reads the
 * same realm and already says so, and a second explanation of one boundary is noise.
 */
export function LogSection({
  search,
  onSearchChange,
}: {
  readonly search: AccountsSearch;
  readonly onSearchChange: (next: AccountsSearch) => void;
}) {
  const view = logViewOf(search);
  const query = useQuery(systemAuditLogQuery(view));
  const roster = useQuery(adminRosterQuery());

  if (query.data === undefined) {
    return query.isError ? <LogUnavailable onRetry={() => void query.refetch()} /> : <LogLoading />;
  }

  const read = readLogOutcome({ outcome: query.data, page: view.page });
  switch (read.kind) {
    case REALM_READ.SIGNED_OUT:
    case REALM_READ.FORBIDDEN:
      return null;
    case REALM_READ.UNAVAILABLE:
      return <LogUnavailable onRetry={() => void query.refetch()} />;
    case REALM_READ.READY: {
      const rosterRead = roster.data === undefined ? null : readRosterOutcome(roster.data);
      const operators =
        rosterRead?.kind === REALM_READ.READY
          ? rosterRead.rows.filter((row) => row.kind === ADMIN_ROSTER_KIND.ACCOUNT)
          : [];
      return (
        <LogBoard
          page={read.page}
          view={view}
          search={search}
          operators={operators}
          refreshing={query.isPlaceholderData}
          onSearchChange={onSearchChange}
        />
      );
    }
  }
}
