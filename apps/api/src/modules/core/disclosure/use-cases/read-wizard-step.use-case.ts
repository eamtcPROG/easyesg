import type { Locale } from '@easyesg/i18n';
import type { DisclosureLabelResolver } from '@api/contracts/disclosure-label.port';
import type {
  RegisteredTaxonomy,
  TaxonomyElement,
  TaxonomyRegistry,
} from '@api/contracts/taxonomy-registry.port';
import { TAXONOMY_STANDARD } from '@api/modules/platform/taxonomy/constants/taxonomy.constants';
import { ReportNotFoundError, TaxonomyVersionUnavailableError } from '../errors/report.errors';
import type { DisclosureValueStore } from '../interfaces/disclosure-value-store.interface';
import type { ReportStore } from '../interfaces/report-store.interface';
import { DISCLOSURE_STATE, type DisclosureValue } from '../models/disclosure-value.model';
import type {
  DisclosureField,
  DisclosureModuleSummary,
  DisclosureStep,
} from '../models/wizard-step.model';

export interface ReadModulesQuery {
  readonly reportId: string;
}

export interface ReadStepQuery {
  readonly reportId: string;
  readonly module: string;
  readonly locale: Locale;
}

/**
 * A field that has been answered, including the three answers that are not numbers.
 *
 * **`missing` is the only state that is not an answer.** FR-30's nil return is an answered zero,
 * FR-31's not-material is a considered exclusion and FR-32's not-available is a deliberate
 * non-answer carrying a reason. Counting those as unanswered would tell a reporter they still have
 * work on a field they have already decided, which is the opposite of what the module list is for.
 */
const isAnswered = (value: DisclosureValue | undefined): boolean =>
  value !== undefined && value.state !== DISCLOSURE_STATE.MISSING;

/** The store's natural key as one string, so a field finds its value without a nested scan. */
const keyOf = (v: {
  readonly elementKey: string;
  readonly dimensionKey: string;
  readonly ordinal: number;
}): string => `${v.elementKey}\u0000${v.dimensionKey}\u0000${v.ordinal}`;

/** The key an undimensioned field holds: no axis member, no position (§7.3). */
const plainKey = (elementKey: string): string =>
  keyOf({ elementKey, dimensionKey: '', ordinal: 0 });

/**
 * UC-19 — what a wizard step and its module list are given (task 89; S-07, FR-24 … FR-32).
 *
 * **The server composes taxonomy, labels and stored values; the screen composes none of them.** S-07
 * describes step content as *"disclosure field labels, help text, values, units, state markers"* —
 * three sources that only this tier can join, since `TAXONOMY_REGISTRY` and the label catalogues are
 * api-side (AD-3; task 33.2) and the values are behind RLS.
 *
 * **Everything resolves against the report's OWN pinned version**, never `pinFor()` and never the
 * newest registered. A report authored under one version must render *that* version's elements after
 * a newer one is adopted — the whole of DR-4 restated at the read boundary, and what task 33.3's
 * second registered version makes testable rather than asserted.
 *
 * **A pinned version the registry no longer carries fails explicitly.** The registry's own header
 * takes that position — *"`null` when that version is not registered, which is how a report pinned to
 * a withdrawn version surfaces as an explicit failure rather than as an empty form"* — and a wizard
 * that rendered no questions would look like a report that asks none.
 */
export class ReadWizardStep {
  constructor(
    private readonly reports: ReportStore,
    private readonly values: DisclosureValueStore,
    private readonly taxonomy: TaxonomyRegistry,
    private readonly labels: DisclosureLabelResolver,
  ) {}

  /** The persistent module list (UX-5), with how much of each module has been answered. */
  async modules(query: ReadModulesQuery): Promise<readonly DisclosureModuleSummary[]> {
    const registered = await this.pinned(query.reportId);
    const byKey = await this.storedByKey(query.reportId);

    const counts = new Map<string, { answered: number; total: number }>();
    for (const element of registered.elements) {
      // The pillar-level catch-alls carry no module (task 33.3). They are reportable and belong to
      // no step, so they are counted into no module rather than into one invented to hold them.
      if (element.module === null) continue;
      const count = counts.get(element.module) ?? { answered: 0, total: 0 };
      count.total += 1;
      if (isAnswered(byKey.get(plainKey(element.key)))) count.answered += 1;
      counts.set(element.module, count);
    }

    // The taxonomy's own module order rather than the map's insertion order: S-07's list reads as
    // the standard does, and `RegisteredTaxonomy.modules` is already in that order.
    return registered.modules.flatMap((module) => {
      const count = counts.get(module);
      return count === undefined ? [] : [{ module, answered: count.answered, total: count.total }];
    });
  }

  /** One step: the module's fields, in the standard's presentation order, with their values. */
  async step(query: ReadStepQuery): Promise<DisclosureStep> {
    const registered = await this.pinned(query.reportId);
    const byKey = await this.storedByKey(query.reportId);
    const catalogue = this.labels.labels({ version: registered.version, locale: query.locale });
    const standing = this.labels.standing({ version: registered.version, locale: query.locale });

    const fields = registered.elements
      .filter((element) => element.module === query.module)
      .map((element) => toField(element, byKey.get(plainKey(element.key)), catalogue, standing));

    return { module: query.module, taxonomyVersion: registered.version, fields };
  }

  private async storedByKey(reportId: string): Promise<Map<string, DisclosureValue>> {
    const stored = await this.values.forReport({ reportId });
    return new Map(stored.map((value) => [keyOf(value), value]));
  }

  /** The report's own pinned taxonomy, or the reason it cannot be served. */
  private async pinned(reportId: string): Promise<RegisteredTaxonomy> {
    const report = await this.reports.findReport({ reportId });
    // RLS makes "not yours" and "not there" one answer (task 31.3), so this cannot say which.
    if (report === null) throw new ReportNotFoundError();

    const registered = this.taxonomy.taxonomy({
      standard: TAXONOMY_STANDARD.VSME,
      version: report.taxonomyVersion,
    });
    if (registered === null) throw new TaxonomyVersionUnavailableError();
    return registered;
  }
}

/**
 * One field, joined from three sources.
 *
 * **A dimensioned element still renders one field here, and that is a stated limit rather than an
 * oversight.** §7.3 keys a value by `(element, dimension, ordinal)`, so a repeating group is as many
 * rows as it has members — but which members a group offers is the axis domain, and rendering a
 * group is task 36.1's *disclosure field anatomy*. This read serves the undimensioned key so a step
 * is answerable now; the 34 dimensioned elements arrive with the component that can draw them.
 */
function toField(
  element: TaxonomyElement,
  value: DisclosureValue | undefined,
  catalogue: Readonly<Record<string, { readonly text: string; readonly standing: string }>> | null,
  fallbackStanding: string | null,
): DisclosureField {
  const label = catalogue?.[element.key] ?? null;
  return {
    elementKey: element.key,
    dimensionKey: '',
    ordinal: 0,
    kind: element.kind,
    periodType: element.periodType,
    axes: element.axes,
    order: element.order,
    label: label?.text ?? null,
    // The catalogue's own standing where the label resolved, the version's otherwise — so a field
    // whose wording is missing still says whose wording it would have been (NFR-24, UX-47).
    labelStanding: label?.standing ?? fallbackStanding,
    valueNumeric: value?.valueNumeric ?? null,
    valueText: value?.valueText ?? null,
    valueBoolean: value?.valueBoolean ?? null,
    valueDate: value?.valueDate ?? null,
    unitCode: value?.unitCode ?? null,
    state: value?.state ?? DISCLOSURE_STATE.MISSING,
    notAvailableReason: value?.notAvailableReason ?? null,
    carriedForward: value?.carriedForward ?? false,
  };
}
