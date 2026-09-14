import {
  API_OUTCOME,
  type ApiOutcome,
  type ListResult,
  type SystemAuditLogEntry,
} from '@easyesg/contracts';
import type { IndexPage } from '@easyesg/ui';
import { REALM_READ, realmReadFailureOf, type RealmReadFailure } from '../../shared/tools/realm-read';
import { LOG_PAGE_SIZE } from './accounts-search';

/**
 * A-08's log read, as the arm its section draws (task 67.4) — A-02's page shape: `matched` is what the
 * filters admitted and pages count from, `total` everything, which is what tells the log's two empty
 * states apart.
 */
export type LogRead =
  | { readonly kind: typeof REALM_READ.READY; readonly page: IndexPage<SystemAuditLogEntry> }
  | RealmReadFailure;

export const readLogOutcome = (input: {
  readonly outcome: ApiOutcome<ListResult<SystemAuditLogEntry>>;
  readonly page: number;
}): LogRead => {
  const { outcome } = input;
  if (outcome.status !== API_OUTCOME.Ok) return realmReadFailureOf(outcome);

  return {
    kind: REALM_READ.READY,
    page: {
      rows: outcome.value.items,
      matched: outcome.value.total,
      // The route filters, so `unfiltered` is always published; `total` stands in only if an older api
      // omitted it, which reads as "the filters matched everything" — never as first use.
      total: outcome.value.unfiltered ?? outcome.value.total,
      page: input.page,
      pageSize: LOG_PAGE_SIZE,
    },
  };
};
