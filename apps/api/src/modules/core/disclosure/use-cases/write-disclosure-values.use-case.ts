import type { TaxonomyRegistry } from '@api/contracts/taxonomy-registry.port';
import { TAXONOMY_STANDARD } from '@api/modules/platform/taxonomy/constants/taxonomy.constants';
import { ReportNotFoundError, TaxonomyVersionUnavailableError } from '../errors/report.errors';
import { UnknownDisclosureElementError } from '../errors/report.errors';
import type { DisclosureValueStore } from '../interfaces/disclosure-value-store.interface';
import type { ReportStore } from '../interfaces/report-store.interface';
import type {
  DisclosureValue,
  DisclosureValueContents,
  DisclosureValueKey,
} from '../models/disclosure-value.model';

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
  ) {}

  async write(command: WriteDisclosureValuesCommand): Promise<DisclosureValue[]> {
    const report = await this.reports.findReport({ reportId: command.reportId });
    // RLS makes "not yours" and "not there" one answer (task 31.3).
    if (report === null) throw new ReportNotFoundError();

    const registered = this.taxonomy.taxonomy({
      standard: TAXONOMY_STANDARD.VSME,
      version: report.taxonomyVersion,
    });
    if (registered === null) throw new TaxonomyVersionUnavailableError();

    const known = new Set(registered.elements.map((element) => element.key));
    // Refused before any write, so a batch is all-or-nothing about what it names. A partially
    // applied autosave would leave the indicator saying `saved` over a step that is not.
    const unknown = command.values.filter((value) => !known.has(value.elementKey));
    if (unknown.length > 0) throw new UnknownDisclosureElementError();

    const written: DisclosureValue[] = [];
    for (const value of command.values) {
      written.push(
        await this.values.write({
          key: {
            reportId: command.reportId,
            elementKey: value.elementKey,
            dimensionKey: value.dimensionKey,
            ordinal: value.ordinal,
          },
          contents: value.contents,
        }),
      );
    }
    return written;
  }
}
