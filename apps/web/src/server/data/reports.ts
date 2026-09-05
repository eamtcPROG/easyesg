import 'server-only';
import type { Report, ReportingEntity, ReportingPeriod } from '@easyesg/contracts';
import { API_OUTCOME } from '@/lib/api-outcome';
import { toReportRows, type ReportRow } from '@/features/reports/reports';
import { api } from '../api-client';
import { TENANT_READ, isPermissionRefusal } from './tenant-read';

/**
 * S-06's read, and the two the creation flow needs (tasks 32.2.2, 32.3).
 *
 * `entities.ts`'s split again: this file knows the routes and what their failures mean, and the
 * feature module beside it knows what the data means.
 *
 * **The row's entity name and year come from the read, not from a second request.** Task 32.2.1
 * made `GET /reports` answer a `subject` resolved by join, precisely so the row that exists to name
 * an entity and a year does not have to fetch either — the `?codes=` shape task 30.4.2 needed for
 * the entities index is not needed here, and asking for it would be N requests for data already in
 * hand.
 */
export type ReportListRead =
  | { readonly status: typeof TENANT_READ.READY; readonly rows: readonly ReportRow[] }
  | { readonly status: typeof TENANT_READ.FORBIDDEN }
  | { readonly status: typeof TENANT_READ.UNREACHABLE };

export async function readReportList(): Promise<ReportListRead> {
  const reports = await api.getList<Report>('/reports');

  if (isPermissionRefusal(reports)) return { status: TENANT_READ.FORBIDDEN };
  if (reports.status !== API_OUTCOME.Ok) return { status: TENANT_READ.UNREACHABLE };

  return { status: TENANT_READ.READY, rows: toReportRows(reports.value.items) };
}

/**
 * What the creation flow can offer (task 32.3).
 *
 * **Two reads and not one, because `GET /periods` is scoped to an entity by design** — *"a period
 * only means anything against one"* (FR-21), and the parameter is required. So the flow asks for an
 * entity first and the periods follow from that choice; the entity rides the address rather than
 * component state, which is UX-4 and is what makes a half-made choice a link.
 *
 * **Two refusal causes are filtered here rather than met on submit**, and the second was missed on
 * the first pass. A period holds at most one report (the API's own rule), *and* `CreateReport`
 * refuses a **locked** period outright — FR-26's *"an editable session is refused where the period
 * is locked"*, UC-18's precondition, and task 31.2's rule that the lock is not a role gate. Either
 * one offered would put a refusal behind a control that looked available, which is `entities.ts`'s
 * reasoning about a control that cannot act applied to an option that cannot be chosen. Filtering
 * one of the two and not the other is the same defect wearing the fix.
 */
export type ReportCreationRead =
  | {
      readonly status: typeof TENANT_READ.READY;
      readonly entities: readonly { readonly id: string; readonly name: string }[];
      /** Empty until an entity is chosen, and empty again when every period of it is taken. */
      readonly periods: readonly ReportingPeriod[];
    }
  | { readonly status: typeof TENANT_READ.FORBIDDEN }
  | { readonly status: typeof TENANT_READ.UNREACHABLE };

export async function readReportCreation(entityId?: string): Promise<ReportCreationRead> {
  const entities = await api.getList<ReportingEntity>('/entities');

  if (isPermissionRefusal(entities)) return { status: TENANT_READ.FORBIDDEN };
  if (entities.status !== API_OUTCOME.Ok) return { status: TENANT_READ.UNREACHABLE };

  const named = entities.value.items
    .map((entity) => ({ id: entity.id, name: entity.name }))
    .sort((left, right) => left.name.localeCompare(right.name));

  // No entity chosen yet: the screen renders its first decision and asks for nothing else.
  if (entityId === undefined) {
    return { status: TENANT_READ.READY, entities: named, periods: [] };
  }

  // Sequential after the entities, and a data dependency rather than a waterfall to fix: which
  // periods to read is what the caller's choice decides.
  const [periods, existing] = await Promise.all([
    api.getList<ReportingPeriod>(`/periods?reportingEntityId=${encodeURIComponent(entityId)}`),
    api.getList<Report>(`/reports?reportingEntityId=${encodeURIComponent(entityId)}`),
  ]);

  if (periods.status !== API_OUTCOME.Ok || existing.status !== API_OUTCOME.Ok) {
    // The entities arrived; the periods did not. Reported as unreachable rather than as an empty
    // period list, because "this entity has no open period" and "we could not ask" are different
    // answers and only one of them is the reader's to act on.
    return { status: TENANT_READ.UNREACHABLE };
  }

  const taken = new Set(existing.value.items.map((report) => report.reportingPeriodId));

  return {
    status: TENANT_READ.READY,
    entities: named,
    periods: periods.value.items.filter(
      (period) => !taken.has(period.id) && period.lockedAt === null,
    ),
  };
}
