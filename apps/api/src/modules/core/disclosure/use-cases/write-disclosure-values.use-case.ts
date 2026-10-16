import type { TaxonomyAxis, TaxonomyRegistry } from '@api/contracts/taxonomy-registry.port';
import { TAXONOMY_STANDARD } from '@api/modules/platform/taxonomy/constants/taxonomy.constants';
import {
  ComputedFigureNotWritableError,
  ReportNotFoundError,
  TaxonomyVersionUnavailableError,
} from '../errors/report.errors';
import { valueRefusal } from '../domain/value-refusal';
import type { DisclosureValueStore } from '../interfaces/disclosure-value-store.interface';
import type { ReportStore } from '../interfaces/report-store.interface';
import type { AxisShapes } from '../interfaces/axis-shape.interface';
import {
  answeredState,
  type DisclosureValue,
  type DisclosureValueContents,
  type DisclosureValueKey,
} from '../models/disclosure-value.model';
import type { RefusedValue, WriteDisclosureValuesOutcome } from '../models/refused-write.model';
import type {
  DerivationRecalculator,
  Derivations,
} from '../interfaces/derivation.interface';

/** One field's new contents, addressed by the store's natural key. */
export interface DisclosureValueInput extends Omit<DisclosureValueKey, 'reportId'> {
  readonly contents: DisclosureValueContents;
}

export interface WriteDisclosureValuesCommand {
  readonly reportId: string;
  readonly values: readonly DisclosureValueInput[];
}

/**
 * UC-35 — autosave's server half (task 89; FR-37, FR-38, UX-34 … UX-36).
 *
 * **It takes one or more values, and that is the requirement rather than a convenience.** FR-37
 * persists "each field change automatically **on blur or step change**": a blur carries one field, a
 * step change or an offline queue flush (FR-38) carries whatever accumulated. One endpoint that
 * accepts a list serves both, and a per-field endpoint would make the queue flush N round trips on
 * the connection that was just unavailable.
 *
 * **Idempotent because the key is natural, not because a token says so.** §7.3 keys a value by
 * `(report, element, dimension, ordinal)` and the store upserts on it, so FR-38's retry of a queued
 * change writes the same row again rather than a second one. AD-6's idempotency keys exist for
 * effects that leave the system; this effect is a row.
 *
 * **Every element is checked against the report's OWN pinned taxonomy.** A value stored under a key
 * that version does not name is the defect task 34.2's typed facade was built to prevent, one layer
 * down — "a live row under a key nothing reads" — and it would survive every read in this module,
 * because a read walks the taxonomy and would simply never ask for it.
 *
 * **The lock is not checked here.** FR-22 is enforced by the trigger beneath the store, which the
 * repository translates into `ReportNotEditableError` (task 31.3, P-4). A read-then-write check here
 * would be a second copy of the rule and would lose the race the trigger cannot.
 */
export class WriteDisclosureValues {
  constructor(
    private readonly reports: ReportStore,
    private readonly values: DisclosureValueStore,
    private readonly taxonomy: TaxonomyRegistry,
    private readonly derivations: Derivations,
    private readonly calculator: DerivationRecalculator,
    private readonly axisShapes: AxisShapes,
  ) {}

  async write(command: WriteDisclosureValuesCommand): Promise<WriteDisclosureValuesOutcome> {
    const report = await this.reports.findReport({ reportId: command.reportId });
    // RLS makes "not yours" and "not there" one answer (task 31.3).
    if (report === null) throw new ReportNotFoundError();

    const registered = this.taxonomy.taxonomy({
      standard: TAXONOMY_STANDARD.VSME,
      version: report.taxonomyVersion,
    });
    if (registered === null) throw new TaxonomyVersionUnavailableError();

    const known = new Map(registered.elements.map((element) => [element.key, element]));
    const breakdowns = this.axisShapes.breakdownAxes({ standard: registered.standard });
    const derived = new Set(this.derivations.all({ standard: TAXONOMY_STANDARD.VSME }).keys());

    // **Each value is judged on its own, and what is admitted is stored** (task 218; §12.5.6's task-218 row (1)). Until
    // then a batch was all-or-nothing about what it named, so the indicator could never say *saved* over half a step —
    // and one answer refused for good held every later one back, since autosave flushes its queue in one request. The
    // indicator's truth is kept by the client instead: a refused value is set aside and reads *failed* (row (3)).
    const refused: RefusedValue[] = [];
    const admitted: DisclosureValueInput[] = [];
    for (const value of command.values) {
      const refusal = valueRefusal({
        value,
        known,
        breakdowns,
        derived,
        axisOf: (key) => this.axisOf(report.taxonomyVersion, key),
      });
      if (refusal === null) admitted.push(value);
      else refused.push({ key: keyOf(value), modules: known.get(value.elementKey)?.modules ?? [], refusal });
    }

    const stored: DisclosureValue[] = [];
    for (const value of admitted) {
      try {
        stored.push(
          await this.values.write({
            key: { reportId: command.reportId, ...keyOf(value) },
            // FR-30: an answered zero is a nil return, decided from the value rather than taken from
            // the caller (P-4). See `answeredState` for why it settles both directions.
            contents: { ...value.contents, state: answeredState(value.contents) },
          }),
        );
      } catch (error) {
        // **A figure the calculator computed is the field's refusal, not the report's** (task 38.4): its guarded upsert
        // writes nothing and raises nothing, so the transaction stands and the rest may still be stored. A lock or an
        // archived entity raises in the database, aborts the transaction, and refuses the report — rethrown.
        if (!(error instanceof ComputedFigureNotWritableError)) throw error;
        refused.push({ key: keyOf(value), modules: known.get(value.elementKey)?.modules ?? [], refusal: error });
      }
    }

    // Anything a derivation reads may have just moved. Recomputed **after** the batch rather than
    // per value, because a formula's operands can arrive in one request — B8's three turnover inputs
    // do — and recomputing between them would write a rate from a half-applied batch. Over what was
    // stored: a refused value moved nothing.
    if (stored.length > 0) {
      await this.calculator.recompute({
        reportId: command.reportId,
        standard: TAXONOMY_STANDARD.VSME,
        touched: new Set(stored.map((value) => value.elementKey)),
      });
    }
    return { stored, refused, taxonomyVersion: report.taxonomyVersion };
  }

  private axisOf(version: string, key: string): TaxonomyAxis | null {
    return this.taxonomy.axis({ standard: TAXONOMY_STANDARD.VSME, version, key });
  }
}

/** One value's key without its report — what a refusal names. */
const keyOf = (value: DisclosureValueInput): RefusedValue['key'] => ({
  elementKey: value.elementKey,
  dimensionKey: value.dimensionKey,
  ordinal: value.ordinal,
});
