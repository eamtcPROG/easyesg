import {
  API_OUTCOME,
  PROBLEM_TYPE,
  SUPPORT_ACCESS_STATE,
  type ApiFailure,
  type ApiOutcome,
  type ListResult,
  type SupportAccessLogEntry,
} from '@easyesg/contracts';
import type { IndexPage } from '@easyesg/ui';
import { REALM_READ, realmReadFailureOf, type RealmReadFailure } from '~/realm/tools/realm-read';
import { SUPPORT_ACCESS_PAGE_SIZE } from './support-access-search';

/**
 * What A-07's reads answered, as the arms its regions draw (task 67.9) — the realm's three failures, and for a read
 * under a grant a fourth that means something none of them does.
 */

export type LogRead =
  | { readonly kind: typeof REALM_READ.READY; readonly page: IndexPage<SupportAccessLogEntry> }
  | RealmReadFailure;

/** One page of the log. It has no filter, so what it matched is everything there is. */
export const readLogOutcome = (input: {
  readonly outcome: ApiOutcome<ListResult<SupportAccessLogEntry>>;
  readonly page: number;
}): LogRead => {
  const { outcome } = input;
  if (outcome.status !== API_OUTCOME.Ok) return realmReadFailureOf(outcome);
  return {
    kind: REALM_READ.READY,
    page: {
      rows: outcome.value.items,
      matched: outcome.value.total,
      total: outcome.value.total,
      page: input.page,
      pageSize: SUPPORT_ACCESS_PAGE_SIZE,
    },
  };
};

/** What is still happening: requests an organization has yet to answer, and grants still running. */
export interface InProgress {
  readonly awaiting: readonly SupportAccessLogEntry[];
  readonly active: readonly SupportAccessLogEntry[];
}

export const inProgressOf = (entries: readonly SupportAccessLogEntry[]): InProgress => ({
  awaiting: entries.filter((entry) => entry.state === SUPPORT_ACCESS_STATE.AWAITING),
  active: entries.filter((entry) => entry.state === SUPPORT_ACCESS_STATE.ACTIVE),
});

/**
 * Whether the log is worth asking again soon. **Every read of it is itself a logged acquisition** (FR-79), so it
 * is polled only while something on it can change without this operator acting — an organization answering, or a
 * grant running out — and an idle console writes nothing to the log it is showing.
 */
export const logIsMoving = (outcome: ApiOutcome<ListResult<SupportAccessLogEntry>> | undefined): boolean => {
  if (outcome?.status !== API_OUTCOME.Ok) return false;
  const { awaiting, active } = inProgressOf(outcome.value.items);
  return awaiting.length > 0 || active.length > 0;
};

/** A read under a grant has one arm the realm's reads do not: the grant is no longer running. */
export const GRANT_READ = {
  ...REALM_READ,
  ENDED: 'ended',
} as const;

export type GrantReadFailure = RealmReadFailure | { readonly kind: typeof GRANT_READ.ENDED };

/**
 * **`support-access-required` is checked before the status**, because it is a 403 and the realm's reading of a 403
 * is *your role does not reach this* — while this one means the grant ended, expired or was never granted, which a
 * Platform Administrator can do something about: ask again.
 */
export const grantReadFailureOf = (failure: ApiFailure): GrantReadFailure =>
  failure.status === API_OUTCOME.Problem && failure.problem.type === PROBLEM_TYPE.SupportAccessRequired
    ? { kind: GRANT_READ.ENDED }
    : realmReadFailureOf(failure);
