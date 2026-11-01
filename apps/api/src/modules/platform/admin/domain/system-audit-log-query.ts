import { isAuditAction } from '@api/modules/platform/audit/models/audit-action.model';
import type { SystemAuditLogQuery } from '../models/system-audit-log.model';
import { isUuid } from '@api/contracts/types/uuid';

/**
 * A-08's log filters, narrowed from what arrived (task 67.4; UC-88) — `organization-register-query`'s
 * shape for a second Index.
 *
 * **Every filter is its own query parameter, never a compact facet**, for the register's search
 * reason in a different form: an instant is a number and an action is a dotted string, and the
 * compact grammar's separators would have to be escaped around both. **A value this route does not
 * understand is dropped rather than refused**: a stale bookmark or a hand-edited address should show
 * the unfiltered log with the filter cleared, not an error about a filter nobody is looking at.
 *
 * Instants arrive as epoch milliseconds, the wire's representation. The console turns a picked
 * calendar day into the two instants that bound it in the operator's own zone, because which instant
 * "13 September" starts at is the reader's question and not the server's.
 */
/** Up to fifteen digits — every epoch millisecond until the year 33658, and nothing that overflows. */
const EPOCH_MILLIS = /^\d{1,15}$/u;

const instantOf = (value: unknown): Date | null =>
  typeof value === 'string' && EPOCH_MILLIS.test(value) ? new Date(Number(value)) : null;

export const toSystemAuditLogQuery = (input: {
  readonly list: { readonly skip: number; readonly take: number | undefined };
  readonly operator: unknown;
  readonly action: unknown;
  readonly from: unknown;
  readonly to: unknown;
  readonly fallbackTake: number;
}): SystemAuditLogQuery => ({
  operatorId: isUuid(input.operator) ? input.operator : null,
  action: isAuditAction(input.action) ? input.action : null,
  from: instantOf(input.from),
  to: instantOf(input.to),
  skip: Math.max(0, input.list.skip),
  // The interceptor always supplies a page size on this route; the fallback covers the type and a
  // route that lost its interceptor, which then serves one page rather than the whole log.
  take: input.list.take ?? input.fallbackTake,
});
