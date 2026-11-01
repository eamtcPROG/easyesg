import { API_OUTCOME, type AdminRosterRow, type ApiOutcome, type ListResult } from '@easyesg/contracts';
import { REALM_READ, realmReadFailureOf, type RealmReadFailure } from '~/realm/tools/realm-read';

/**
 * A-08's account table read, as the arm its section draws (task 67.4). The roster is unpaginated —
 * tens of rows — so a ready read is the rows themselves, with no page to count.
 */
export type RosterRead =
  | { readonly kind: typeof REALM_READ.READY; readonly rows: readonly AdminRosterRow[] }
  | RealmReadFailure;

export const readRosterOutcome = (outcome: ApiOutcome<ListResult<AdminRosterRow>>): RosterRead =>
  outcome.status === API_OUTCOME.Ok
    ? { kind: REALM_READ.READY, rows: outcome.value.items }
    : realmReadFailureOf(outcome);
