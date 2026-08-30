import type { Clock } from '@api/contracts/clock.port';
import { isLegalDate, type LegalDate } from '@api/contracts/types/time';
import type { TaxonomyRegistry } from '@api/contracts/taxonomy-registry.port';
import { ENTITY_STATUS } from '@api/modules/core/entity/models/reporting-entity.model';
import type { ReportingEntityStore } from '@api/modules/core/entity/interfaces/reporting-entity-store.interface';
import { EntityArchivedError, EntityNotFoundError } from '@api/modules/core/entity/errors/entity.errors';
import type {
  NewReportingPeriod,
  ReportingPeriod,
  ReportingPeriodPatch,
} from '../models/reporting-period.model';
import type { ReportingPeriodStore } from '../interfaces/reporting-period-store.interface';
import {
  PeriodDatesInvalidError,
  PeriodLockedError,
  PeriodNotFoundError,
  TaxonomyVersionUnavailableError,
} from '../errors/period.errors';

export interface OpenPeriodCommand {
  readonly period: NewReportingPeriod;
}
export interface UpdatePeriodCommand {
  readonly periodId: string;
  readonly patch: ReportingPeriodPatch;
}

/**
 * UC-56 — open a reporting period, and edit the shell afterwards (FR-21, FR-45, FR-66).
 *
 * **Three of UC-56's five steps are not the caller's to supply, and that is the whole design.** The
 * Administrator states the fiscal year and its dates (step 1) and optionally a due date (step 5).
 * The version pin (step 3) and the prior-period link (step 4) are resolved here and in the store;
 * neither appears on the request DTO. A route that accepted a taxonomy version would let a caller
 * pin a report to a version of their choosing, which is DR-4 inverted.
 *
 * **The pin comes from `TAXONOMY_REGISTRY.pinFor()`, never from `max(registeredVersions())`.** Task
 * 33.3 registers a second version in staging deliberately, so "the newest registered" is a version
 * the platform has not adopted; the date EFRAG publishes a release and the date this platform adopts
 * it are different facts (OQ-45).
 *
 * **`pinFor` is asked for the period's own start date, not for today.** A period backfilled for
 * 2025 must pin what was in force *then* — the registry's entry is effective-dated for exactly this,
 * and asking it about today would pin a 2025 filing to a taxonomy adopted in 2027.
 */
export class OpenReportingPeriod {
  constructor(
    private readonly store: ReportingPeriodStore,
    private readonly entities: ReportingEntityStore,
    private readonly taxonomy: TaxonomyRegistry,
    private readonly now: Clock,
  ) {}

  async open(command: OpenPeriodCommand): Promise<ReportingPeriod> {
    const { period } = command;
    admitDates(period);

    // FR-20: an archived entity keeps its history and takes no new work. Reading the entity here
    // also proves it belongs to the bound tenant — RLS answers null for another organization's id,
    // which is the same "not found" a made-up one gets.
    const entity = await this.entities.findEntity(period.reportingEntityId);
    if (!entity) throw new EntityNotFoundError();
    if (entity.status === ENTITY_STATUS.ARCHIVED) throw new EntityArchivedError();

    const pin = this.taxonomy.pinFor({ on: period.periodStart.date });
    if (!pin) throw new TaxonomyVersionUnavailableError();

    return this.store.open({
      period,
      templateVersion: pin.templateVersion,
      taxonomyVersion: pin.taxonomyVersion,
      at: this.now(),
    });
  }

  async update(command: UpdatePeriodCommand): Promise<ReportingPeriod> {
    // The patch is partial, so the dates are validated against the row as it will stand rather than
    // against what arrived — moving only the end date past the start is otherwise unrepresentable
    // as a failure here and would be caught by a constraint violation instead.
    const current = await this.store.findPeriod({ periodId: command.periodId });
    if (!current) throw new PeriodNotFoundError();

    // FR-22: a locked period takes no writes, the administrator's included — the shell as much as
    // the report (§12.5.6's task-31.2 rows). Checked here so the caller gets a message naming the
    // way out; the database's own trigger refuses it again, which is what closes the read-then-lock
    // race this check cannot.
    if (current.lockedAt !== null) throw new PeriodLockedError();

    // **Field by field, never `{ ...current, ...patch }`.** A DTO class field declared `foo?: T` is
    // *defined* as `undefined` on every instance under `useDefineForClassFields`, so spreading a
    // patch that names only the due date silently overwrites the stored start and end with
    // `undefined` — which read as absent here and crashed rather than validating. Found by the e2e
    // suite; the repository's own loop skips `undefined` and was never affected.
    //
    // `dueDate` is compared to `undefined` rather than coalesced because **`null` is a meaningful
    // patch value**: it clears the due date, and `??` would silently restore the stored one.
    admitDates({
      periodStart: command.patch.periodStart ?? current.periodStart,
      periodEnd: command.patch.periodEnd ?? current.periodEnd,
      dueDate: command.patch.dueDate === undefined ? current.dueDate : command.patch.dueDate,
    });

    const updated = await this.store.update({ ...command, at: this.now() });
    if (!updated) throw new PeriodNotFoundError();
    return updated;
  }
}

/**
 * The shape rules, as one function both writes share.
 *
 * Kept out of the class because it takes no dependency and every branch is a unit test that needs
 * no store — which is the check `apps/api/CLAUDE.md` names for whether a use case is framework-free.
 */
const admitDates = (period: {
  readonly periodStart: LegalDate;
  readonly periodEnd: LegalDate;
  readonly dueDate?: LegalDate | null;
}): void => {
  for (const value of [period.periodStart, period.periodEnd, period.dueDate]) {
    if (value !== null && value !== undefined && !isLegalDate(value)) throw new PeriodDatesInvalidError();
  }
  // String comparison, and correct rather than lucky: an ISO calendar date sorts chronologically as
  // text, which is the same property OQ-45's version identifier relies on.
  if (period.periodEnd.date < period.periodStart.date) throw new PeriodDatesInvalidError();
};
