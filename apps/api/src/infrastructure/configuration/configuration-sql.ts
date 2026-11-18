import type { QueryRunner } from 'typeorm';

/**
 * The statements the publisher and the drafts share (tasks 67.14, 67.15): the slot's advisory lock, its next revision,
 * and the `[from,to)` window literal — so a draft and a publication of one slot serialise on the same lock and number
 * their versions from the same sequence.
 */

/**
 * One writer per slot at a time (task 67.11). A transaction-scoped advisory lock rather than `FOR UPDATE` on the slot
 * row, because a slot's first publication — or first draft — has no row to lock.
 */
export const lockSlot = async (runner: QueryRunner, slot: { readonly kind: string; readonly scope: string }) => {
  await runner.query(`SELECT pg_advisory_xact_lock(hashtextextended($1::text || '/' || $2::text, 0))`, [
    slot.kind,
    slot.scope,
  ]);
};

/** The next revision of a slot, over every version it holds — drafts included, which hold their numbers. */
export const nextRevision = async (
  runner: QueryRunner,
  slot: { readonly kind: string; readonly scope: string },
): Promise<number> => {
  const rows = (await runner.query(
    `SELECT coalesce(max(revision), 0) + 1 AS next FROM config.entry_version WHERE kind = $1 AND scope = $2`,
    [slot.kind, slot.scope],
  )) as { next: number }[];
  return Number(rows[0].next);
};

/** A `[from,to)` literal, with an empty bound rendering as unbounded. */
export const windowLiteral = (from: string | null | undefined, to: string | null | undefined): string =>
  `[${from ?? ''},${to ?? ''})`;
