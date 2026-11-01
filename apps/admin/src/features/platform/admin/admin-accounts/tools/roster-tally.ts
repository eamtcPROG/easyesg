import { ADMIN_ROSTER_KIND, type AdminRosterRow } from '@easyesg/contracts';

/**
 * How many accounts and invitations A-08's roster holds (task 170) — what the header's summary and the
 * line beneath the table both say, counted once so the two cannot disagree (`section-compute-once`).
 * **The line stands where a pager's position would**: the roster is answered whole and not paged, and
 * §5.2's preamble asks such a list to say how many rows it holds.
 */
export interface RosterTally {
  readonly accounts: number;
  readonly invitations: number;
}

export const rosterTallyOf = (rows: readonly Pick<AdminRosterRow, 'kind'>[]): RosterTally => {
  const accounts = rows.filter((row) => row.kind === ADMIN_ROSTER_KIND.ACCOUNT).length;
  return { accounts, invitations: rows.length - accounts };
};
