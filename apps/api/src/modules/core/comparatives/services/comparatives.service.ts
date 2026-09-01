import { Injectable } from '@nestjs/common';
import type { PriorPeriodComparatives } from '../models/prior-period-value.model';
import { ReadPriorPeriodValues } from '../use-cases/read-prior-period-values.use-case';

/**
 * The Nest-aware seam over FR-45 … FR-47's use cases.
 *
 * One use case today, and that is the honest minimum rather than the pass-through `apps/api
 * /CLAUDE.md` warns against: the seam is the rule, and it is where FR-47's carry-forward joins
 * without `ComparativesController` growing a second caller.
 */
@Injectable()
export class ComparativesService {
  constructor(private readonly priorPeriodValues: ReadPriorPeriodValues) {}

  priorPeriod(query: { readonly reportId: string }): Promise<PriorPeriodComparatives> {
    return this.priorPeriodValues.read(query);
  }
}
