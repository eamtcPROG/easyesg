import type { AdminRosterRow } from '@easyesg/contracts';
import { DataTable } from '@easyesg/ui';
import { useTranslations } from 'use-intl';
import type { AccountAction } from '../../../tools/account-action-state';
import type { RosterTally } from '../../../tools/roster-tally';
import { useRosterColumns } from './roster-columns';

/** Hoisted, so the table receives the same function every render. */
const rowKey = (row: AdminRosterRow): string => row.id;

/**
 * A-08's account table (task 67.4). **A table, not an Index**: the roster is tens of rows, read whole,
 * with no page to turn and no search — and it is never empty, since the reader holds one of its
 * accounts.
 *
 * **It says how many rows it holds beneath itself** (task 170; §5.2's preamble), where a paged list's
 * pager would stand — the tally the board counted once, so it agrees with the header's summary.
 */
export function RosterList({
  rows,
  tally,
  operatorId,
  busy,
  onOpen,
  onControl,
}: {
  readonly rows: readonly AdminRosterRow[];
  readonly tally: RosterTally;
  readonly operatorId: string;
  readonly busy: boolean;
  readonly onOpen: (id: string) => void;
  readonly onControl: (action: AccountAction) => void;
}) {
  const t = useTranslations('platform.accounts.table');
  const columns = useRosterColumns({ operatorId, busy, onOpen, onControl });

  return (
    <div className="flex min-w-0 flex-col gap-[var(--space-3)]">
      <DataTable caption={t('caption')} columns={columns} rows={rows} rowKey={rowKey} />
      <p className="t-caption text-[var(--text-muted)]">{t('count', { accounts: tally.accounts, invitations: tally.invitations })}</p>
    </div>
  );
}
