import type { components } from './generated/v1';
import type { SameSet } from './same-set';

/**
 * Where a reporting entity stands (FR-20) — the mirror of `apps/api`'s `ENTITY_STATUS`, which the api derives its
 * contract enum from and may not import from here (`membership.ts`'s reason).
 *
 * **What it adds over the generated union is the runtime value**, and the screens that read it are several since task
 * 187: an archived entity is listed and filtered on S-13, offered no new report on S-39 and no new period on S-14, and
 * its periods ask for no attention on S-05. Each of those compares against a member; S-13's own copy of the set, its
 * `ENTITY_STANDING`, folded into this one then. Held to both generated enums that carry it at compile time — the
 * entity's own status and the one a period carries beside its entity's name — so either side gaining, losing or
 * renaming a member fails `pnpm typecheck` here, naming the mirror.
 */
export const ENTITY_STATUS = {
  ACTIVE: 'active',
  /** FR-20: out of active selection, its periods, reports and exports intact. Read-only, never deleted. */
  ARCHIVED: 'archived',
} as const;

export type EntityStatus = (typeof ENTITY_STATUS)[keyof typeof ENTITY_STATUS];

type WireEntityStatus = components['schemas']['ReportingEntityResponseDto']['status'];
type WirePeriodEntityStatus = components['schemas']['ReportingPeriodResponseDto']['entityStatus'];
/** A report's subject names its entity's standing since task 214 — read-only from the archive (FR-20). */
type WireReportEntityStatus = components['schemas']['ReportSubjectDto']['entityStatus'];

export const ENTITY_STATUS_MIRRORS_WIRE: SameSet<EntityStatus, WireEntityStatus> = true;
export const PERIOD_ENTITY_STATUS_MIRRORS_WIRE: SameSet<EntityStatus, WirePeriodEntityStatus> = true;
export const REPORT_ENTITY_STATUS_MIRRORS_WIRE: SameSet<EntityStatus, WireReportEntityStatus> = true;
