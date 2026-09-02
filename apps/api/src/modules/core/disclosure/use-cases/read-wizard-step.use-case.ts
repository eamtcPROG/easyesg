import type { DisclosureLabel, Locale } from '@easyesg/i18n';
import { DISCLOSURE_KIND } from '@easyesg/vsme';
import type { DisclosureLabelResolver } from '@api/contracts/disclosure-label.port';
import {
  ENUMERATION_TAXONOMY,
  type RegisteredTaxonomy,
  type TaxonomyElement,
  type TaxonomyEnumeration,
  type TaxonomyRegistry,
} from '@api/contracts/taxonomy-registry.port';
import type { OrganizationVocabulary } from '@api/modules/core/organization/interfaces/organization-vocabulary.interface';

/**
 * The two operations of the vocabulary port this use case calls — a `Pick`, so it depends on no
 * operation it never calls (CLAUDE.md, Interface Segregation), and a spec fakes two methods, not five.
 */
export type WizardVocabulary = Pick<
  OrganizationVocabulary,
  'registeredLegalForms' | 'naceClassifierFor' | 'legalFormMemberFor'
>;

/**
 * Whose vocabularies name NACE members in the two locales EFRAG does not publish, and classify legal
 * forms into EFRAG's five (task 91.2). **Fixed to Moldova rather than read from the report's
 * organization** (task 91.1): both vocabularies are registered per country (§7.2) and only `md`
 * registers either, so there is nothing else to ask for; the day a second country registers one,
 * this becomes a read of the organization's country.
 */
const VOCABULARY_COUNTRY = 'md';
import { TAXONOMY_STANDARD } from '@api/modules/platform/taxonomy/constants/taxonomy.constants';
import { ReportNotFoundError, TaxonomyVersionUnavailableError } from '../errors/report.errors';
import type { DisclosureValueStore } from '../interfaces/disclosure-value-store.interface';
import type { ReportStore } from '../interfaces/report-store.interface';
import { DISCLOSURE_STATE, type DisclosureValue } from '../models/disclosure-value.model';
import type { Report } from '../models/report.model';
import type {
  DisclosureDefault,
  DisclosureField,
  DisclosureModuleSummary,
  DisclosureOption,
  DisclosureStep,
} from '../models/wizard-step.model';
import { entityDefaults, type EntityDefaults } from './entity-defaults';

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

/** No axis member: the key every undimensioned field holds, and every row of a typed axis (§7.3). */
const NO_DIMENSION = '';

/** The stored values, indexed both ways the reads need them. */
interface StoredValues {
  readonly byKey: ReadonlyMap<string, DisclosureValue>;
  readonly byElement: ReadonlyMap<string, readonly DisclosureValue[]>;
}

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
/**
 * Where a read's non-fatal findings go. **A one-method sink rather than a framework logger**,
 * because a use case may not import `@nestjs/common` (`domain-free-of-frameworks`); the module
 * hands in a `Logger`, and a spec hands in an array.
 */
export interface ReadWarnings {
  warn(message: string): void;
}

export class ReadWizardStep {
  constructor(
    private readonly reports: ReportStore,
    private readonly values: DisclosureValueStore,
    private readonly taxonomy: TaxonomyRegistry,
    private readonly labels: DisclosureLabelResolver,
    /**
     * For the two enumeration domains the package does not word (task 91.1): NACE names in Romanian
     * and Russian come from the platform's own CAEM classifier, keyed by the pointed code, and the
     * country domain — ISO 3166, not shipped — offers the countries the platform registers.
     */
    private readonly vocabulary: WizardVocabulary,
    private readonly warnings: ReadWarnings,
  ) {}

  /** The persistent module list (UX-5), with how much of each module has been answered. */
  async modules(query: ReadModulesQuery): Promise<readonly DisclosureModuleSummary[]> {
    const { registered } = await this.pinned(query.reportId);
    const { byElement } = await this.stored(query.reportId);

    const counts = new Map<string, { answered: number; total: number; lastAnsweredAt: number | null }>();
    for (const element of registered.elements) {
      // The pillar-level catch-alls carry no module (task 33.3). They are reportable and belong to
      // no step, so they are counted into no module rather than into one invented to hold them.
      if (element.module === null) continue;
      const count = counts.get(element.module) ?? { answered: 0, total: 0, lastAnsweredAt: null };
      count.total += 1;
      // An element counts as answered when ANY of its rows is (task 91.2): a repeating group's
      // second site is as much an answer as its first, and `total` counts elements, not rows.
      const answered = (byElement.get(element.key) ?? []).filter(isAnswered);
      if (answered.length > 0) {
        count.answered += 1;
        // The latest answer in the module is where work last happened (task 35.3, FR-39). A row
        // cleared back to `missing` is not an answer and does not move it.
        for (const value of answered) {
          if (count.lastAnsweredAt === null || value.updatedAt > count.lastAnsweredAt) {
            count.lastAnsweredAt = value.updatedAt;
          }
        }
      }
      counts.set(element.module, count);
    }

    // The taxonomy's own module order rather than the map's insertion order: S-07's list reads as
    // the standard does, and `RegisteredTaxonomy.modules` is already in that order.
    return registered.modules.flatMap((module) => {
      const count = counts.get(module);
      return count === undefined
        ? []
        : [{ module, answered: count.answered, total: count.total, lastAnsweredAt: count.lastAnsweredAt }];
    });
  }

  /** One step: the module's fields, in the standard's presentation order, with their values. */
  async step(query: ReadStepQuery): Promise<DisclosureStep> {
    const { report, registered } = await this.pinned(query.reportId);
    const { byKey, byElement } = await this.stored(query.reportId);
    const defaults = await this.defaultsFor(report, registered);
    const at = { version: registered.version, locale: query.locale };
    const catalogue = this.labels.labels(at);
    const standing = this.labels.standing(at);
    const options = new OptionResolver({
      registered,
      taxonomy: this.taxonomy,
      memberLabels: this.labels.memberLabels(at),
      vocabulary: this.vocabulary,
      locale: query.locale,
    });

    // Whether an axis is typed is asked of the registry once per axis, not once per element: B1
    // alone names its site axis on five elements.
    const typedAxes = new Map<string, boolean>();
    const isTyped = (key: string): boolean => {
      const known = typedAxes.get(key);
      if (known !== undefined) return known;
      const typed =
        this.taxonomy.axis({ standard: registered.standard, version: registered.version, key })?.typed ?? false;
      typedAxes.set(key, typed);
      return typed;
    };

    const fields = registered.elements
      .filter((element) => element.module === query.module)
      .flatMap((element) => {
        const wording = {
          catalogue,
          standing,
          help: this.labels.help({ ...at, key: element.key }),
          options: options.optionsFor(element),
        };
        const perOrdinal = defaults.get(element.key) ?? [];
        return rowsOf({
          element,
          repeating: element.axes.some(isTyped),
          stored: byElement.get(element.key) ?? [],
          defaultRows: perOrdinal.length,
        }).map((ordinal) => {
          const value = byKey.get(keyOf({ elementKey: element.key, dimensionKey: NO_DIMENSION, ordinal }));
          // A row in any state suppresses the default: cleared is a decision (§12.5.6, task 91.2).
          const defaultValue = value === undefined ? (perOrdinal[ordinal] ?? null) : null;
          return toField(element, { ordinal, value, defaultValue }, wording);
        });
      });

    return { module: query.module, taxonomyVersion: registered.version, fields };
  }

  private async stored(reportId: string): Promise<StoredValues> {
    const stored = await this.values.forReport({ reportId });
    const byElement = new Map<string, DisclosureValue[]>();
    for (const value of stored) {
      byElement.set(value.elementKey, [...(byElement.get(value.elementKey) ?? []), value]);
    }
    return { byKey: new Map(stored.map((value) => [keyOf(value), value])), byElement };
  }

  /**
   * What the platform already knows, for the fields it can answer (task 91.2; FR-27, UX-109).
   *
   * The snapshot is the period's, the scope the report's, and the legal-form member the country's
   * configuration — three sources this tier joins, none of which the screen holds. A code the pinned
   * NACE domain has no member for is logged rather than refused (the owner's decision, §12.5.6).
   */
  private async defaultsFor(report: Report, registered: RegisteredTaxonomy): Promise<EntityDefaults> {
    const snapshot = await this.reports.entitySnapshotOf({ reportId: report.id });
    const legalFormMember =
      snapshot?.legalForm === undefined || snapshot.legalForm === null
        ? null
        : this.vocabulary.legalFormMemberFor({ countryCode: VOCABULARY_COUNTRY, legalForm: snapshot.legalForm });
    const { defaults, unmappedActivityCodes } = entityDefaults({
      registered,
      snapshot,
      scope: report.scope,
      legalFormMember,
    });
    if (unmappedActivityCodes.length > 0) {
      this.warnings.warn(
        `Report ${report.id}: activity code(s) ${unmappedActivityCodes.join(', ')} have no member in ` +
          `${registered.standard} ${registered.version}'s NACE domain and were not pre-filled`,
      );
    }
    return defaults;
  }

  /** The report and its own pinned taxonomy, or the reason it cannot be served. */
  private async pinned(reportId: string): Promise<{ report: Report; registered: RegisteredTaxonomy }> {
    const report = await this.reports.findReport({ reportId });
    // RLS makes "not yours" and "not there" one answer (task 31.3), so this cannot say which.
    if (report === null) throw new ReportNotFoundError();

    const registered = this.taxonomy.taxonomy({
      standard: TAXONOMY_STANDARD.VSME,
      version: report.taxonomyVersion,
    });
    if (registered === null) throw new TaxonomyVersionUnavailableError();
    return { report, registered };
  }
}

/**
 * Which rows a step shows for one element (task 91.2).
 *
 * **An element on a typed axis is a repeating group, and its rows are its ordinals** — every
 * ordinal the store holds plus one per site or subsidiary in the snapshot, in order, so a stored
 * third site and a snapshotted first two render as three rows. Nothing in either is one empty row,
 * as before, so the group is still answerable. Everything else is one row at ordinal 0: the 34
 * elements on *explicit* axes keep task 89's stated limit until the component that draws a
 * member-keyed group exists.
 */
function rowsOf(input: {
  readonly element: TaxonomyElement;
  readonly repeating: boolean;
  readonly stored: readonly DisclosureValue[];
  readonly defaultRows: number;
}): readonly number[] {
  if (!input.repeating) return [0];
  const ordinals = new Set<number>();
  for (const value of input.stored) if (value.dimensionKey === NO_DIMENSION) ordinals.add(value.ordinal);
  for (let ordinal = 0; ordinal < input.defaultRows; ordinal += 1) ordinals.add(ordinal);
  return ordinals.size === 0 ? [0] : [...ordinals].sort((a, b) => a - b);
}

/**
 * One field, joined from four sources: the taxonomy's shape, the catalogue's wording, the store's
 * value and the platform's default.
 *
 * **An element on an explicit axis still renders one field here, and that is a stated limit rather
 * than an oversight.** §7.3 keys a value by `(element, dimension, ordinal)`, so a member-keyed group
 * is as many rows as its axis has members — but which members a group offers is the axis domain,
 * and rendering one is task 36.1's *disclosure field anatomy*. Typed axes — sites, subsidiaries —
 * are the exception since task 91.2: `rowsOf` gives them a row per ordinal.
 */
function toField(
  element: TaxonomyElement,
  row: {
    readonly ordinal: number;
    readonly value: DisclosureValue | undefined;
    readonly defaultValue: DisclosureDefault | null;
  },
  wording: {
    readonly catalogue: Readonly<Record<string, DisclosureLabel>> | null;
    readonly standing: string | null;
    readonly help: DisclosureLabel | null;
    readonly options: readonly DisclosureOption[] | null;
  },
): DisclosureField {
  const { catalogue, standing: fallbackStanding } = wording;
  const { value } = row;
  const label = catalogue?.[element.key] ?? null;
  return {
    elementKey: element.key,
    dimensionKey: NO_DIMENSION,
    ordinal: row.ordinal,
    kind: element.kind,
    periodType: element.periodType,
    axes: element.axes,
    order: element.order,
    label: label?.text ?? null,
    // The catalogue's own standing where the label resolved, the version's otherwise — so a field
    // whose wording is missing still says whose wording it would have been (NFR-24, UX-47).
    labelStanding: label?.standing ?? fallbackStanding,
    help: wording.help?.text ?? null,
    options: wording.options,
    defaultValue: row.defaultValue,
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

/**
 * The answers a choice field offers, per domain (task 91.1).
 *
 * **Three sources, one shape.** A `vsme` domain's members are wording in the catalogues, in the
 * request's locale with the catalogue's standing. NACE's members come from the classification the
 * package ships — English is EFRAG's — and their Romanian and Russian names from the platform's own
 * CAEM classifier by pointed code, which is why the artefact carries `01.11` and not `NACE_A0111`.
 * The country domain is ISO 3166, which the package only references: the members are the countries
 * the platform registers a vocabulary for, and their names are the client's catalogue's, so `label`
 * is `null` there rather than an English word for a Russian reader.
 *
 * **Each domain is resolved once per step**, not once per field: a step can name the same domain
 * from several elements (B1 has two `ListOfDisclosuresMember` fields), and NACE is 1 047 members.
 */
class OptionResolver {
  private readonly cache = new Map<string, readonly DisclosureOption[]>();

  constructor(
    private readonly input: {
      readonly registered: RegisteredTaxonomy;
      readonly taxonomy: TaxonomyRegistry;
      readonly memberLabels: Readonly<Record<string, DisclosureLabel>> | null;
      readonly vocabulary: WizardVocabulary;
      readonly locale: Locale;
    },
  ) {}

  optionsFor(element: TaxonomyElement): readonly DisclosureOption[] | null {
    if (element.kind !== DISCLOSURE_KIND.ENUMERATION && element.kind !== DISCLOSURE_KIND.ENUMERATION_SET) {
      return null;
    }
    if (element.domain === null) return [];
    // The artefact keeps a `vsme` domain unqualified on the element and qualifies every enumeration.
    const key = element.domain.includes(':') ? element.domain : `${ENUMERATION_TAXONOMY.VSME}:${element.domain}`;
    const cached = this.cache.get(key);
    if (cached !== undefined) return cached;

    const enumeration = this.input.taxonomy.enumeration({
      standard: this.input.registered.standard,
      version: this.input.registered.version,
      key,
    });
    const resolved = enumeration === null ? [] : this.resolve(enumeration);
    this.cache.set(key, resolved);
    return resolved;
  }

  private resolve(enumeration: TaxonomyEnumeration): readonly DisclosureOption[] {
    const qualify = (member: string): string => `${enumeration.taxonomy}:${member}`;

    if (enumeration.taxonomy === ENUMERATION_TAXONOMY.COUNTRY) {
      // ISO 3166: the countries the platform registers, named by the client's own catalogue.
      return this.input.vocabulary
        .registeredLegalForms()
        .map(({ countryCode }) => ({ value: qualify(countryCode.toUpperCase()), label: null, code: countryCode.toUpperCase() }));
    }

    if (enumeration.taxonomy === ENUMERATION_TAXONOMY.NACE) {
      // CAEM Rev.2 is NACE Rev.2 with Moldova's typesetting; both are keyed by the pointed code, and
      // the platform's classifier carries the two authored locales EFRAG does not.
      const named = new Map(
        (this.input.vocabulary.naceClassifierFor(VOCABULARY_COUNTRY) ?? []).map((code) => [code.code, code.labels]),
      );
      return enumeration.members.map((member) => ({
        value: qualify(member.key),
        code: member.code,
        label:
          (member.code === null ? undefined : named.get(member.code)?.[this.input.locale]) ??
          member.labels[this.input.locale] ??
          member.labels.en ??
          null,
      }));
    }

    return enumeration.members.map((member) => ({
      value: qualify(member.key),
      code: member.code,
      label: this.input.memberLabels?.[member.key]?.text ?? null,
    }));
  }
}
