import type { Clock } from '@api/contracts/clock.port';
import type { TaxonomyRegistry } from '@api/contracts/taxonomy-registry.port';
import { TAXONOMY_STANDARD } from '@api/modules/platform/taxonomy/constants/taxonomy.constants';
import { basisForPreparationOf, statesBasis } from '../domain/entity-defaults';
import {
  ReportNotEditableError,
  ReportNotFoundError,
  TaxonomyVersionUnavailableError,
} from '../errors/report.errors';
import type { DisclosureValueStore } from '../interfaces/disclosure-value-store.interface';
import type { ReportStore } from '../interfaces/report-store.interface';
import { B1_ELEMENT } from '../models/b1-element.model';
import { DISCLOSURE_STATE, NO_DIMENSION, type DisclosureValueKey } from '../models/disclosure-value.model';
import { REPORT_STATUS, type Report, type ReportPatch } from '../models/report.model';

export interface ChangeReportScopeCommand {
  readonly reportId: string;
  readonly patch: ReportPatch;
}

/**
 * UC-192 — the scope raised or lowered on a report in progress (tasks 31.3, 78.3; FR-177, FR-27).
 *
 * **Nothing an answer holds moves but one.** Raising keeps every B answer and lowering keeps every C answer: what a
 * report shows, counts and exports is read through the scope (`scopeAsks`), so no row needs to be touched for a module
 * to go dark or come back (§12.5.6's task-182 report-authoring row (10)). **The one exception is B1's basis for
 * preparation**, which *is* the scope in EFRAG's words, and which this rewrites in the same transaction so the filing
 * cannot state two bases (§12.5.6's task-78 row (1)).
 *
 * **Only where B1 holds one.** A report storing none of B1's record keys has never had B1 opened, and the period's
 * snapshot follows the entity until it is (task 180.2) — a row written here would end that for a report whose reporter
 * never looked. The field's default is the scope's, so opening B1 commits the new option as it always did.
 *
 * **The lock is checked here and enforced below**, as the creation's is: a scope change inside a locked period is
 * refused by `core.report`'s own trigger, and an archived entity's by its own (task 214), for whoever arrives between
 * this read and the write. Both triggers reach the B1 write too, through the shared report-scoped guard.
 */
export class ChangeReportScope {
  constructor(
    private readonly reports: Pick<ReportStore, 'findReport' | 'update'>,
    private readonly values: Pick<DisclosureValueStore, 'find' | 'write'>,
    private readonly taxonomy: Pick<TaxonomyRegistry, 'taxonomy'>,
    private readonly now: Clock,
  ) {}

  async execute(command: ChangeReportScopeCommand): Promise<Report> {
    const current = await this.reports.findReport({ reportId: command.reportId });
    if (!current) throw new ReportNotFoundError();
    if (current.status === REPORT_STATUS.LOCKED) throw new ReportNotEditableError();

    const updated = await this.reports.update({ ...command, at: this.now() });
    if (!updated) throw new ReportNotFoundError();
    await this.followBasis(updated);
    return updated;
  }

  /** B1's stored basis rewritten to the scope's option, where B1 holds one that says otherwise. */
  private async followBasis(report: Report): Promise<void> {
    const key: DisclosureValueKey = {
      reportId: report.id,
      elementKey: B1_ELEMENT.BASIS_FOR_PREPARATION,
      dimensionKey: NO_DIMENSION,
      ordinal: 0,
    };
    const stored = await this.values.find(key);
    if (stored === null) return;

    const registered = this.taxonomy.taxonomy({ standard: TAXONOMY_STANDARD.VSME, version: report.taxonomyVersion });
    if (registered === null) throw new TaxonomyVersionUnavailableError();
    const basis = basisForPreparationOf({ registered, scope: report.scope });
    // Nothing to write where the version names no such member, or where the answer already states it — an entry in
    // the trail saying a value changed to itself would be a change nobody made.
    if (basis === null || statesBasis({ contents: stored, basis })) return;

    await this.values.write({
      key,
      contents: {
        valueNumeric: null,
        valueText: basis,
        valueBoolean: null,
        valueDate: null,
        unitCode: null,
        state: DISCLOSURE_STATE.OK,
        notAvailableReason: null,
        carriedForward: false,
      },
    });
  }
}
