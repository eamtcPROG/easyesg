import type { TaxonomyElement, TaxonomyRegistry } from '@api/contracts/taxonomy-registry.port';
import { ReportNotFoundError } from '@api/modules/core/disclosure/errors/report.errors';
import { TAXONOMY_STANDARD } from '@api/modules/platform/taxonomy/constants/taxonomy.constants';
import type { PriorPeriodStore } from '../interfaces/prior-period-store.interface';
import type {
  Comparability,
  PriorPeriodComparatives,
} from '../models/prior-period-value.model';
import { COMPARABILITY, PRIOR_PERIOD_AVAILABILITY } from '../models/prior-period-value.model';

export interface ReadPriorPeriodValuesQuery {
  readonly reportId: string;
}

/**
 * UC-45 — last year's value for this year's field (FR-45, FR-46).
 *
 * **The linkage is resolved, never chosen.** FR-45's acceptance criterion is that the prior period
 * "resolves from the linkage recorded under FR-21 without manual selection", so nothing here takes a
 * period from the caller. Task 31.1 *maintains* that link rather than setting it once — a backfilled
 * year repoints its successor — which is what makes a single hop trustworthy.
 *
 * **Comparability is decided here because this is the only tier that can decide it.** The two
 * reports carry their own pins (DR-4), the registry knows what each version says an element is, and
 * `TAXONOMY_REGISTRY` is an api port with no browser-side equivalent. Task 36.14 renders the verdict;
 * it cannot compute one.
 *
 * **Recorded assumption: the standard is VSME.** `core.report` stores `taxonomy_version` and
 * `template_version` and *no standard column*, while `TaxonomyPin` carries one — so the pin's
 * standard is dropped at persistence today and this asks the registry under `TAXONOMY_STANDARD.VSME`.
 * True while VSME is the only standard registered; a second one needs a column on the report before
 * it needs anything here, and that is a migration rather than an edit to this file.
 */
export class ReadPriorPeriodValues {
  constructor(
    private readonly store: PriorPeriodStore,
    private readonly taxonomy: TaxonomyRegistry,
  ) {}

  async read(query: ReadPriorPeriodValuesQuery): Promise<PriorPeriodComparatives> {
    const readout = await this.store.readFor({ reportId: query.reportId });
    // RLS makes "not yours" and "not there" the same answer, so this cannot say which (task 31.3).
    if (readout === null) throw new ReportNotFoundError();

    const { taxonomyVersion, priorPeriodLinked, prior } = readout;

    if (prior === null) {
      return {
        reportId: query.reportId,
        taxonomyVersion,
        availability: priorPeriodLinked
          ? PRIOR_PERIOD_AVAILABILITY.NO_PRIOR_REPORT
          : PRIOR_PERIOD_AVAILABILITY.NO_PRIOR_PERIOD,
        prior: null,
        values: [],
      };
    }

    return {
      reportId: query.reportId,
      taxonomyVersion,
      availability: PRIOR_PERIOD_AVAILABILITY.AVAILABLE,
      prior: {
        reportId: prior.reportId,
        periodId: prior.periodId,
        fiscalYear: prior.fiscalYear,
        taxonomyVersion: prior.taxonomyVersion,
      },
      values: prior.values.map((value) => ({
        ...value,
        comparability: this.compare({
          elementKey: value.elementKey,
          currentVersion: taxonomyVersion,
          priorVersion: prior.taxonomyVersion,
        }),
      })),
    };
  }

  /**
   * Whether last year's element is this year's element.
   *
   * **Both version parameters are named, and that is the rule rather than a preference.** They are
   * adjacent `string`s: swapped positionally this compiles, reads the pair backwards, and answers
   * `comparable` or `element_absent` just as confidently — a wrong answer with no failure anywhere.
   */
  private compare(query: {
    readonly elementKey: string;
    readonly currentVersion: string;
    readonly priorVersion: string;
  }): Comparability {
    // **The same pin cannot disagree with itself.** A short-circuit rather than a special case: the
    // registry would answer identically, and this only avoids a lookup per element that cannot
    // change the verdict.
    if (query.currentVersion === query.priorVersion) return COMPARABILITY.COMPARABLE;

    const current = this.elementIn({ version: query.currentVersion, key: query.elementKey });
    // Last year reported something this year's taxonomy no longer names, so there is no field for it
    // to sit beside. Not an error: DR-4 makes exactly this survivable.
    if (current === null) return COMPARABILITY.ELEMENT_ABSENT;

    const prior = this.elementIn({ version: query.priorVersion, key: query.elementKey });
    // The prior element ought to exist -- the value was authored against it -- but a version
    // withdrawn from the registry answers `null` for every key, and calling that `comparable` would
    // assert an equality nothing checked.
    if (prior === null) return COMPARABILITY.ELEMENT_ABSENT;

    return current.kind === prior.kind && current.periodType === prior.periodType
      ? COMPARABILITY.COMPARABLE
      : COMPARABILITY.SHAPE_CHANGED;
  }

  private elementIn(query: { readonly version: string; readonly key: string }): TaxonomyElement | null {
    return this.taxonomy.element({
      standard: TAXONOMY_STANDARD.VSME,
      version: query.version,
      key: query.key,
    });
  }
}
