import 'server-only';
import type { PeriodReopening, ReportingEntity, ReportingPeriod } from '@easyesg/contracts';
import { API_OUTCOME } from '@/lib/api-outcome';
import { api } from '../api-client';
import { TENANT_READ, isPermissionRefusal } from './tenant-read';

/**
 * S-14's reads (task 32.1.2) — the periods of one entity, and one period with its amendments.
 *
 * `entities.ts`'s split: this file knows the routes and what their failures mean, and the feature's
 * own module holds the rules over what comes back.
 *
 * **The entity is read alongside the periods, and it is not decoration.** A period only means
 * anything against an entity — that is why `GET /periods` requires `reportingEntityId` at all — so
 * the screen has to name which undertaking these years belong to. An organization reporting on
 * three entities has three period lists, and a heading reading only *"Reporting periods"* would
 * make them indistinguishable in a bookmark, a screenshot or a support message.
 */
export type PeriodListRead =
  | {
      readonly status: typeof TENANT_READ.READY;
      readonly entity: ReportingEntity;
      readonly periods: readonly ReportingPeriod[];
    }
  | { readonly status: typeof TENANT_READ.FORBIDDEN }
  | { readonly status: typeof TENANT_READ.UNREACHABLE };

export async function readPeriodList(entityId: string): Promise<PeriodListRead> {
  // Independent reads, so they do not queue (`async-parallel`). Both are tenant-scoped by the
  // session; neither takes an organization.
  const [entity, periods] = await Promise.all([
    api.get<ReportingEntity>(`/entities/${entityId}`),
    api.getList<ReportingPeriod>(`/periods?reportingEntityId=${encodeURIComponent(entityId)}`),
  ]);

  if (isPermissionRefusal(entity) || isPermissionRefusal(periods)) {
    return { status: TENANT_READ.FORBIDDEN };
  }
  if (entity.status !== API_OUTCOME.Ok || periods.status !== API_OUTCOME.Ok) {
    return { status: TENANT_READ.UNREACHABLE };
  }

  return { status: TENANT_READ.READY, entity: entity.value, periods: periods.value.items };
}

export type PeriodRecordRead =
  | {
      readonly status: typeof TENANT_READ.READY;
      readonly entity: ReportingEntity;
      readonly period: ReportingPeriod;
      /**
       * UX-72's record. **Read with the period rather than behind a disclosure**, because the
       * requirement is that an amendment *looks like* an amendment — one that has to be opened to
       * be seen is one a reader can miss, which is the state the requirement exists to prevent.
       */
      readonly reopenings: readonly PeriodReopening[];
    }
  | { readonly status: typeof TENANT_READ.FORBIDDEN }
  | { readonly status: typeof TENANT_READ.UNREACHABLE };

export async function readPeriodRecord(input: {
  readonly entityId: string;
  readonly periodId: string;
}): Promise<PeriodRecordRead> {
  const [entity, period, reopenings] = await Promise.all([
    api.get<ReportingEntity>(`/entities/${input.entityId}`),
    api.get<ReportingPeriod>(`/periods/${input.periodId}`),
    api.getList<PeriodReopening>(`/periods/${input.periodId}/reopenings`),
  ]);

  if (isPermissionRefusal(entity) || isPermissionRefusal(period)) {
    return { status: TENANT_READ.FORBIDDEN };
  }
  if (entity.status !== API_OUTCOME.Ok || period.status !== API_OUTCOME.Ok) {
    return { status: TENANT_READ.UNREACHABLE };
  }

  return {
    status: TENANT_READ.READY,
    entity: entity.value,
    period: period.value,
    // **A failed amendment read does not fail the screen**, following the activity labels in
    // `entities.ts`: the period is what the reader came for. It degrades to "no reopenings shown",
    // which is honest — and the lock state, which is the fact that actually gates editing, comes
    // from the period itself rather than from this list.
    reopenings: reopenings.status === API_OUTCOME.Ok ? reopenings.value.items : [],
  };
}
