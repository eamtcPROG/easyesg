import { Injectable } from '@nestjs/common';
import type { FieldAddress, Finding, Verdict } from '@easyesg/validation';
import type { LegalDate } from '@api/contracts/types/time';
import type { ValidationStore } from '@api/modules/core/validation/interfaces/validation-store.interface';
import type { ModuleRollUp, RollUp } from '@api/modules/core/validation/models/roll-up.model';
import type { StoredValidation, ValidationRun } from '@api/modules/core/validation/models/validation-run.model';
import { TenantRepository } from '../tenant-repository';

interface RunRow {
  evaluated_at: Date;
  evaluated_by: string | null;
  rules_on: string;
  rules_on_tz: string;
  rules_revision: number;
  resolved: number;
  reasoned: number;
  outstanding: number;
}

interface ModuleRow {
  module: string;
  resolved: number;
  reasoned: number;
  outstanding: number;
  outstanding_fields: FieldAddress[];
}

interface FindingRow {
  rule_id: string;
  verdict: Verdict;
  element_key: string;
  dimension_key: string;
  ordinal: number;
  related: FieldAddress[];
  message: string;
  params: Record<string, string>;
}

/** `::text` on the date, as on every date column: the driver would answer an instant, and a day is not one (NFR-34). */
const RUN_COLUMNS = `evaluated_at, evaluated_by, rules_on::text AS rules_on, rules_on_tz, rules_revision,
                     resolved, reasoned, outstanding`;

const toRun = (row: RunRow): ValidationRun => ({
  evaluatedAt: row.evaluated_at,
  evaluatedBy: row.evaluated_by,
  rulesOn: { date: row.rules_on, timezone: row.rules_on_tz },
  rulesRevision: row.rules_revision,
});

const toModule = (row: ModuleRow): ModuleRollUp => ({
  module: row.module,
  resolved: row.resolved,
  reasoned: row.reasoned,
  outstanding: row.outstanding,
  outstandingFields: row.outstanding_fields,
});

const toFinding = (row: FindingRow): Finding => ({
  rule: row.rule_id,
  verdict: row.verdict,
  field: { elementKey: row.element_key, dimensionKey: row.dimension_key, ordinal: row.ordinal },
  related: row.related,
  message: row.message,
  params: row.params,
});

/**
 * `ValidationStore` over `core.validation_run` and `core.validation_finding` (task 41.2; FR-43).
 *
 * **On the request's transaction, naming no organization** — `TenantRepository`'s rule: RLS binds every statement to
 * the request's tenant, and the report's own row supplies `organization_id` to each insert, so no signature carries it.
 *
 * **A run replaces the report's run, whole.** The previous run is deleted, which takes its findings and its roll-up with
 * it, and the new
 * one is written with every finding in **one** statement, from a JSON array the interpreter's own order numbers — so a
 * report holds one run's findings at any instant the transaction commits, never a mixture. The lock's trigger is not on
 * these tables (182/21), so a locked report's run is written like any other.
 */
@Injectable()
export class ValidationStoreRepository extends TenantRepository<never> implements ValidationStore {
  protected readonly entity = 'core.validation_run' as never;

  async replace(command: {
    readonly reportId: string;
    readonly rulesOn: LegalDate;
    readonly rulesRevision: number;
    readonly findings: readonly Finding[];
    readonly rollUp: RollUp;
  }): Promise<ValidationRun | null> {
    await this.manager.query(`DELETE FROM core.validation_run WHERE report_id = $1`, [command.reportId]);
    const { report } = command.rollUp;
    const runs = await this.manager.query<RunRow[]>(
      `INSERT INTO core.validation_run
           (organization_id, report_id, rules_on, rules_on_tz, rules_revision, resolved, reasoned, outstanding)
       SELECT r.organization_id, r.id, $2::date, $3, $4, $5, $6, $7 FROM core.report r WHERE r.id = $1
       RETURNING ${RUN_COLUMNS}`,
      [
        command.reportId,
        command.rulesOn.date,
        command.rulesOn.timezone,
        command.rulesRevision,
        report.resolved,
        report.reasoned,
        report.outstanding,
      ],
    );
    const run = runs[0];
    if (run === undefined) return null;
    if (command.findings.length > 0) {
      await this.manager.query(
        `INSERT INTO core.validation_finding
             (organization_id, report_id, position, rule_id, verdict, element_key, dimension_key, ordinal,
              related, message, params)
         SELECT r.organization_id, r.id, f.position, f.rule_id, f.verdict, f.element_key, f.dimension_key, f.ordinal,
                f.related, f.message, f.params
           FROM core.report r,
                jsonb_to_recordset($2::jsonb) AS f(position int, rule_id text, verdict text, element_key text,
                                                   dimension_key text, ordinal int, related jsonb, message text,
                                                   params jsonb)
          WHERE r.id = $1`,
        [
          command.reportId,
          JSON.stringify(
            command.findings.map((finding, position) => ({
              position,
              rule_id: finding.rule,
              verdict: finding.verdict,
              element_key: finding.field.elementKey,
              dimension_key: finding.field.dimensionKey,
              ordinal: finding.field.ordinal,
              related: finding.related,
              message: finding.message,
              params: finding.params,
            })),
          ),
        ],
      );
    }
    if (command.rollUp.modules.length > 0) {
      await this.manager.query(
        `INSERT INTO core.validation_module
             (organization_id, report_id, module, resolved, reasoned, outstanding, outstanding_fields)
         SELECT r.organization_id, r.id, m.module, m.resolved, m.reasoned, m.outstanding, m.outstanding_fields
           FROM core.report r,
                jsonb_to_recordset($2::jsonb) AS m(module text, resolved int, reasoned int, outstanding int,
                                                   outstanding_fields jsonb)
          WHERE r.id = $1`,
        [
          command.reportId,
          JSON.stringify(
            command.rollUp.modules.map((module) => ({
              module: module.module,
              resolved: module.resolved,
              reasoned: module.reasoned,
              outstanding: module.outstanding,
              outstanding_fields: module.outstandingFields,
            })),
          ),
        ],
      );
    }
    return toRun(run);
  }

  async read(query: { readonly reportId: string }): Promise<StoredValidation | null> {
    const runs = await this.manager.query<RunRow[]>(
      `SELECT ${RUN_COLUMNS} FROM core.validation_run WHERE report_id = $1`,
      [query.reportId],
    );
    const run = runs[0];
    if (run === undefined) return null;
    const findings = await this.manager.query<FindingRow[]>(
      `SELECT rule_id, verdict, element_key, dimension_key, ordinal, related, message, params
         FROM core.validation_finding
        WHERE report_id = $1
        ORDER BY position`,
      [query.reportId],
    );
    // In the standard's order, which the run wrote them in and a reader is shown them in.
    const modules = await this.manager.query<ModuleRow[]>(
      `SELECT module, resolved, reasoned, outstanding, outstanding_fields
         FROM core.validation_module
        WHERE report_id = $1
        ORDER BY substring(module from '^[A-Z]+'), substring(module from '[0-9]+$')::int`,
      [query.reportId],
    );
    return {
      run: toRun(run),
      findings: findings.map(toFinding),
      rollUp: {
        report: { resolved: run.resolved, reasoned: run.reasoned, outstanding: run.outstanding },
        modules: modules.map(toModule),
      },
    };
  }
}
