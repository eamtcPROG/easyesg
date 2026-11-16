import { Injectable } from '@nestjs/common';
import { withSharedReads } from '@api/infrastructure/persistence/shared-reads';
import { ReadPriorPeriodValues } from '@api/modules/core/comparatives/use-cases/read-prior-period-values.use-case';
import { ReportService } from '@api/modules/core/disclosure/services/report.service';
import { WizardService } from '@api/modules/core/disclosure/services/wizard.service';
import { ValidationRulesUnavailableError } from '../errors/validation.errors';
import type { StepPage } from '../models/step-page.model';
import { ValidationService } from './validation.service';

/**
 * S-07's step in one read (task 244; `architecture.md` §12.5.6's task-244 row (6)): the step, the module list, the
 * report, last year's answers for the step's fields, the last run and the rules the browser checks answers by.
 *
 * **Why one request.** The screen read these as separate requests in parallel, and every request pays the same fixed
 * cost before its first query — the session's resolution, its own transaction, the tenant binding — while each runs on
 * a connection of its own and reads the report and its answers again for itself. One request pays that cost once, and
 * inside `withSharedReads` the report and its stored answers are read once for all of them.
 *
 * **Here, in `core/validation`**, because this module already reads the wizard's and the comparatives' modules for a
 * run, so the composition adds no dependency between modules — owned where it can be built without a cycle, as the
 * export's reads are owned by the module that composes them.
 *
 * **The rules degrade to `null`** where no rule set can be read: validation is an aid, never a precondition of
 * answering (182/27), and the step must still render. Every other refusal is the step's own, as the separate reads
 * answered it — a report not there 404, a module the pinned version does not carry 404, a module outside the scope 409.
 */
@Injectable()
export class StepPageService {
  constructor(
    private readonly reports: ReportService,
    private readonly wizard: WizardService,
    private readonly prior: ReadPriorPeriodValues,
    private readonly validation: ValidationService,
  ) {}

  page(query: { readonly reportId: string; readonly module: string }): Promise<StepPage> {
    return withSharedReads(async () => {
      const report = await this.reports.view(query.reportId);
      const step = await this.wizard.step(query);
      const modules = await this.wizard.modules({ reportId: query.reportId });
      const prior = await this.prior.read({
        reportId: query.reportId,
        elementKeys: [...new Set(step.fields.map((field) => field.elementKey))],
      });
      const validation = await this.validation.read({ reportId: query.reportId });
      const rules = await this.validation.rules({ reportId: query.reportId }).catch((error: unknown) => {
        if (error instanceof ValidationRulesUnavailableError) return null;
        throw error;
      });
      return { report, adopted: this.reports.adopted(), modules, step, prior, validation, rules };
    });
  }
}
