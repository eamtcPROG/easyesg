import { evaluateRules } from '@easyesg/validation';
import type { Clock } from '@api/contracts/clock.port';
import { ReportNotFoundError } from '@api/modules/core/disclosure/errors/report.errors';
import { ruleSetDate } from '../domain/rule-set-date';
import { findingsInScope } from '../domain/findings-in-scope';
import { rollUp } from '../domain/roll-up';
import { ValidationRulesUnavailableError } from '../errors/validation.errors';
import type { EvaluationScopes } from '../interfaces/evaluation-scopes.interface';
import type { PriorComparables } from '../interfaces/prior-comparables.interface';
import type { ValidationReports, ValidationReport } from '../interfaces/validation-reports.interface';
import type { RuleSetInForce, ValidationRuleSets } from '../interfaces/validation-rule-sets.interface';
import type { ValidationStore } from '../interfaces/validation-store.interface';
import type { ValidationReading } from '../models/validation-run.model';

export interface RunValidationCommand {
  readonly reportId: string;
}

export interface ReadValidationQuery {
  readonly reportId: string;
}

/**
 * UC-40 — run validation, and read what the last run found (task 41.2; FR-40, FR-43; `architecture.md` §12.5.6's
 * task-182 validation row and task-41 row).
 *
 * **One class for the two, because they read the report's scope the same way**: the run evaluates over it and the read
 * drops a finding whose field has left it (182/26), and one predicate of *in scope* is what keeps a run's findings and a
 * later read's from disagreeing about a field that applies.
 *
 * **A run, at any completeness, replaces the report's findings** (FR-43): the interpreter is deterministic over its
 * input (BR-VAL-3), so a run over unchanged answers stores the same findings, and a corrected field's finding is simply
 * not among the new ones. **Nothing refuses a locked report** (182/21): it is the one about to be exported, and it reads
 * the rule set its lock pinned (task-41 row (5)).
 *
 * **When it runs is the caller's** — an explicit run here, and an export request (47.4) and a notice's schedule (51.2)
 * later (182/26) — so it takes no request context and branches on no caller.
 */
export class RunValidation {
  constructor(
    private readonly reports: ValidationReports,
    private readonly scopes: EvaluationScopes,
    private readonly priors: PriorComparables,
    private readonly ruleSets: ValidationRuleSets,
    private readonly store: ValidationStore,
    private readonly now: Clock,
  ) {}

  async run(command: RunValidationCommand): Promise<ValidationReading> {
    const report = await this.found(command.reportId);
    const rulesOn = {
      date: ruleSetDate({ lockedAt: report.lockedAt, timezone: report.timezone, now: this.now() }),
      timezone: report.timezone,
    };
    const rules = await this.rulesFor({ report, on: rulesOn.date });
    if (rules === null) throw new ValidationRulesUnavailableError();

    const { values, scope, modules } = await this.scopes.evaluationScope({ reportId: command.reportId });
    const prior = await this.priors.comparable({ reportId: command.reportId });
    const findings = evaluateRules({ ruleSet: rules.ruleSet, scope: new Set(scope.keys()), values, prior });
    // UC-38's signal, from what this run read and found (task 41.3) — computed once, here, and read as it is left.
    const counted = rollUp({ scope, modules, values, findings });

    const run = await this.store.replace({
      reportId: command.reportId,
      rulesOn,
      rulesRevision: rules.revision,
      findings,
      rollUp: counted,
    });
    // The report was found above in this transaction, so the run row was written; a null is a vanished report.
    if (run === null) throw new ReportNotFoundError();
    return { run, findings, rollUp: counted };
  }

  async read(query: ReadValidationQuery): Promise<ValidationReading> {
    await this.found(query.reportId);
    const stored = await this.store.read({ reportId: query.reportId });
    if (stored === null) return { run: null, findings: [], rollUp: null };
    const { scope } = await this.scopes.evaluationScope({ reportId: query.reportId });
    return {
      run: stored.run,
      findings: findingsInScope({ findings: stored.findings, scope }),
      rollUp: stored.rollUp,
    };
  }

  private async found(reportId: string): Promise<ValidationReport> {
    // RLS makes "not yours" and "not there" one answer (task 31.3).
    const report = await this.reports.find({ reportId });
    if (report === null) throw new ReportNotFoundError();
    return report;
  }

  /**
   * A locked report reads the revision its lock pinned; one locked before pins existed, and an open one, read the set
   * in force on the day `ruleSetDate` gives — the lock's, or today (FR-73 item 9; task-41 row (5)).
   */
  private async rulesFor(input: {
    readonly report: ValidationReport;
    readonly on: string;
  }): Promise<RuleSetInForce | null> {
    const { lockedAt, ruleSetPin } = input.report;
    if (lockedAt !== null && ruleSetPin !== null) return this.ruleSets.pinned({ revision: ruleSetPin });
    return this.ruleSets.inForce({ on: input.on });
  }
}
