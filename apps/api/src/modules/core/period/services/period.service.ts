import { Inject, Injectable } from '@nestjs/common';
import type { ReportingPeriod } from '../models/reporting-period.model';
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
    @Inject(REPORTING_PERIOD_STORE) private readonly store: ReportingPeriodStore,
  ) {}

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
}
