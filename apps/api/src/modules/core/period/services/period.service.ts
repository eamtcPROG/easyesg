import { Inject, Injectable } from '@nestjs/common';
import { requestContext } from '@api/infrastructure/persistence/request-context';
import type { PeriodReopening, ReportingPeriod } from '../models/reporting-period.model';
import {
  REPORTING_PERIOD_STORE,
  type ReportingPeriodStore,
} from '../interfaces/reporting-period-store.interface';
import { PeriodNotFoundError } from '../errors/period.errors';
// A value import, not `import type` — Nest reads `design:paramtypes` from the value graph, and an
// erased type-only import leaves `Function` in the metadata (see `EntityService`'s note).
import {
  OpenReportingPeriod,
  type OpenPeriodCommand,
  type UpdatePeriodCommand,
} from '../use-cases/open-reporting-period.use-case';
import { LockReportingPeriod } from '../use-cases/lock-reporting-period.use-case';

/**
 * The Nest-aware seam between `PeriodsController` and the use case (house rule: controllers call
 * services, services call use cases).
 *
 * The reads go straight to the store because there is no use case in them — RLS scopes the
 * statement and no rule applies. The writes carry UC-56, which is where `OpenReportingPeriod`
 * earns its place.
 */
@Injectable()
export class PeriodService {
  constructor(
    private readonly openPeriod: OpenReportingPeriod,
    private readonly lockPeriod: LockReportingPeriod,
    @Inject(REPORTING_PERIOD_STORE) private readonly store: ReportingPeriodStore,
  ) {}

  /**
   * **The actor is resolved here, from the request context, and is never a field on a request.**
   * FR-22 records *who* locked and reopened; an attribution the caller could name is not an
   * attribution. This is `EntityService`'s locale rule applied to identity — the same reason this
   * layer exists rather than the controller calling the use case.
   */
  private get actorId(): string | null {
    return requestContext()?.actorId ?? null;
  }

  list(input: { readonly reportingEntityId: string }): Promise<ReportingPeriod[]> {
    return this.store.listPeriods(input);
  }

  async view(periodId: string): Promise<ReportingPeriod> {
    const period = await this.store.findPeriod({ periodId });
    if (!period) throw new PeriodNotFoundError();
    return period;
  }

  open(command: OpenPeriodCommand): Promise<ReportingPeriod> {
    return this.openPeriod.open(command);
  }

  update(command: UpdatePeriodCommand): Promise<ReportingPeriod> {
    return this.openPeriod.update(command);
  }

  lock(input: { readonly periodId: string }): Promise<ReportingPeriod> {
    return this.lockPeriod.lock({ ...input, actorId: this.actorId });
  }

  reopen(input: { readonly periodId: string; readonly reason: string }): Promise<ReportingPeriod> {
    return this.lockPeriod.reopen({ ...input, actorId: this.actorId });
  }

  async reopenings(periodId: string): Promise<PeriodReopening[]> {
    // The period is read first so an unknown id answers 404 rather than an empty history, which
    // would read as "never reopened" for a period that does not exist.
    await this.view(periodId);
    return this.lockPeriod.reopenings({ periodId });
  }
}
