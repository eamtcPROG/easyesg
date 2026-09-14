import type { AdminRosterRow } from '@easyesg/contracts';
import { DataTable } from '@easyesg/ui';
import { useTranslations } from 'use-intl';
import { useRosterColumns } from './roster-columns';

/** Hoisted, so the table receives the same function every render. */
const rowKey = (row: AdminRosterRow): string => row.id;

/**
 * A-08's account table (task 67.4). **A table, not an Index**: the roster is tens of rows, read whole,
 * with no page to turn and no search — and it is never empty, since the reader holds one of its
 * accounts.
 */
export function RosterList({
  rows,
  onOpen,
}: {
  readonly rows: readonly AdminRosterRow[];
  readonly onOpen: (id: string) => void;
}) {
  const t = useTranslations('platform.accounts.table');
  const columns = useRosterColumns({ onOpen });

  return <DataTable caption={t('caption')} columns={columns} rows={rows} rowKey={rowKey} />;
}
