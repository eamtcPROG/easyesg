import type { DisclosureLabel, Locale } from '@easyesg/i18n';
import { DISCLOSURE_KIND } from '@easyesg/vsme';
import type { DisclosureLabelResolver } from '@api/contracts/disclosure-label.port';
import {
  ENUMERATION_TAXONOMY,
  type EnumerationTaxonomy,
  type RegisteredTaxonomy,
  type TaxonomyAxis,
  type TaxonomyElement,
  type TaxonomyMember,
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

/**
 * The one language EFRAG publishes the external classifications in (task 36.8).
 *
 * Declared here and unexported, on `VOCABULARY_COUNTRY`'s precedent above: it is a fact about the
 * package this module reads, not a vocabulary anything else shares. All 973 members of the EU List
 * of Waste carry an `en` label and nothing else — so a Romanian reporter picking a waste entry is
 * shown English, and `DisclosureAxis.memberLanguage` is how the screen learns to say so.
 *
 * **A locale rather than a flag**: the day Romanian names are authored the fallback stops firing and
 * the note disappears on its own, with nothing to remember to turn off.
 */
const PUBLISHED_CLASSIFICATION_LOCALE: Locale = 'en';
import { TAXONOMY_STANDARD } from '@api/modules/platform/taxonomy/constants/taxonomy.constants';
import { ReportNotFoundError, TaxonomyVersionUnavailableError } from '../errors/report.errors';
import type { ApplicabilityRules } from '../interfaces/applicability-rules.interface';
import type { AxisShapes } from '../interfaces/axis-shape.interface';
import type { DerivationInputStore } from '../interfaces/derivation-input-store.interface';
import { MEMBER_SEPARATOR } from '@easyesg/vsme';
import { OPERAND_SOURCE, type Derivation } from '../models/derivation.model';
import { OMITTED_DISCLOSURES_ELEMENT, omittedModules } from '../models/omission.model';
import type { DerivationService } from '../services/derivation.service';
import type { TemplateDefaultService } from '../services/template-default.service';
import type { DisclosureValueStore } from '../interfaces/disclosure-value-store.interface';
import type { ReportStore } from '../interfaces/report-store.interface';
import {
  APPLICABILITY_CONDITION,
  type ApplicabilityRule,
  type EvaluatedApplicability,
} from '../models/applicability.model';
import {
  DEFAULT_DISCLOSURE_ORIGIN,
  DISCLOSURE_STATE,
  isAnsweredState,
  type DisclosureValue,
} from '../models/disclosure-value.model';
import type { Report } from '../models/report.model';
import type {
  DerivationInputField,
  DisclosureApplicabilityCause,
  DisclosureAxis,
  DisclosureDefault,
  DisclosureField,
  DisclosureModuleSummary,
  DisclosureOption,
  DisclosureStep,
} from '../models/wizard-step.model';
import { evaluateApplicability, soleCause, type MemberAncestry } from './applicability';
import { entityDefaults, type EntityDefaults } from './entity-defaults';

export interface ReadModulesQuery {
  readonly reportId: string;
  /**
   * For the applicability cause's wording (task 91.3). The list carries a cause like the step does,
   * because a module can go whole — B6 does — and UX-27's announcement is the same announcement.
   */
  readonly locale: Locale;
}

export interface ReadStepQuery {
  readonly reportId: string;
  readonly module: string;
  readonly locale: Locale;
}

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
    /**
     * FR-28's conditional applicability, as configuration (task 91.3). Read here rather than in the
     * browser because only this tier holds the stored B1 answers and the store — and because UX-27's
     * announcement needs the cause, which a boolean computed anywhere else would not carry.
     */
    private readonly applicability: ApplicabilityRules,
    /**
     * Which explicit axes are breakdowns, as configuration (task 36.4). Beside `applicability` and
     * for its reason: an axis's *shape* is a fact about the standard that EFRAG's package does not
     * state, so it is published rather than released (AD-4, DR-3).
     */
    private readonly axisShapes: AxisShapes,
    /**
     * Which figures the platform derives, as configuration (task 36.10). The step read needs it to
     * serve their inputs; the write path needs it to refuse a typed rate.
     */
    private readonly derivations: DerivationService,
    /** Where the reporter's answers to those inputs are kept — `core.report_derivation_input`. */
    private readonly derivationInputs: DerivationInputStore,
    /** The answers EFRAG's template ships a field already holding (task 36.11). */
    private readonly templateDefaults: TemplateDefaultService,
    private readonly warnings: ReadWarnings,
  ) {}

  /** The persistent module list (UX-5), with how much of each module has been answered. */
  async modules(query: ReadModulesQuery): Promise<readonly DisclosureModuleSummary[]> {
    const { registered } = await this.pinned(query.reportId);
    const { byElement } = await this.stored(query.reportId);
    const applicability = this.applicabilityOf({ registered, byElement });
    const catalogue = this.labels.labels({ version: registered.version, locale: query.locale });
    // UX-29's third state, derived from B1's own declaration rather than stored per module — VSME's
    // only omission ground, stated where ¶24(b) requires it (task 36.13).
    const omitted = this.omittedModules({ registered, byElement });

    const counts = new Map<string, ModuleCount>();
    for (const element of registered.elements) {
      // An element FR-28 has ruled out is not part of this report's obligations, so it is counted
      // into neither side of the module's progress (task 91.3): a services company that can never
      // fill B6 must not be shown a denominator it cannot reach. Its cause is kept, because a
      // module every one of whose elements has gone is a module that has gone, and UX-27 asks why.
      const verdict = applicability.get(element.key);
      // An element counts as answered when ANY of its rows is (task 91.2): a repeating group's
      // second site is as much an answer as its first, and `total` counts elements, not rows.
      const answered = (byElement.get(element.key) ?? []).filter((value) => isAnsweredState(value.state));

      // **Counted into every module that presents it** (task 36.4). The eight disclosures B3 and C3
      // share are one obligation with one stored value, so each module's own denominator includes
      // them and both progress figures move together — which is what the taxonomy says, and what a
      // Comprehensive reporter filling B3 should see on C3.
      //
      // The pillar-level catch-alls present in none (task 33.3). They are reportable and belong to
      // no step, so they are counted into no module rather than into one invented to hold them.
      for (const module of element.modules) {
        const count = counts.get(module) ?? newModuleCount();
        counts.set(module, count);

        if (verdict !== undefined && !verdict.applicable) {
          count.causes.push(verdict);
          continue;
        }

        count.applicable = true;
        count.total += 1;
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
      }
    }

    // The taxonomy's own module order rather than the map's insertion order: S-07's list reads as
    // the standard does, and `RegisteredTaxonomy.modules` is already in that order.
    return registered.modules.flatMap((module) => {
      const count = counts.get(module);
      if (count === undefined) return [];
      // One cause or none — `soleCause` states the rule and a unit case reaches its other branch,
      // which the four shipped rules cannot produce (gate-integrity review, 3 Sep 2026).
      const only = count.applicable ? undefined : soleCause(count.causes);
      return [
        {
          module,
          answered: count.answered,
          total: count.total,
          lastAnsweredAt: count.lastAnsweredAt,
          applicable: count.applicable,
          applicabilityCause: toCause(only, catalogue),
          omitted: omitted.has(module),
        },
      ];
    });
  }

  /** One step: the module's fields, in the standard's presentation order, with their values. */
  async step(query: ReadStepQuery): Promise<DisclosureStep> {
    const { report, registered } = await this.pinned(query.reportId);
    const { byKey, byElement } = await this.stored(query.reportId);
    // Read unconditionally rather than only for B8 and B9: the step does not yet know which of its
    // fields are derived — that is settled below, off the artefact — and this is one indexed read of
    // at most four rows against a branch that would have to be kept in step with the artefact.
    const storedInputs = new Map(
      (await this.derivationInputs.forReport({ reportId: query.reportId })).map((input) => [
        input.inputKey,
        input.valueNumeric,
      ]),
    );
    const defaults = await this.defaultsFor(report, registered);
    const applicability = this.applicabilityOf({ registered, byElement });
    const at = { version: registered.version, locale: query.locale };
    const catalogue = this.labels.labels(at);
    const standing = this.labels.standing(at);
    // Read once and shared: the same catalogue names a choice field's answers and a member-keyed
    // group's columns, and it is 181 entries at `2026-05-01`.
    const memberLabels = this.labels.memberLabels(at);
    const options = new OptionResolver({
      registered,
      taxonomy: this.taxonomy,
      memberLabels,
      vocabulary: this.vocabulary,
      locale: query.locale,
    });
    const members = new MemberResolver({
      registered,
      taxonomy: this.taxonomy,
      memberLabels,
      locale: query.locale,
      breakdownAxes: this.axisShapes.breakdownAxes({ standard: registered.standard }),
      classificationAxes: this.axisShapes.classificationAxes({ standard: registered.standard }),
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

    // Which classification domains this step needs, filled by the walk below (task 36.5).
    const classifications = new Set<string>();
    // Every member chosen on each classification axis, across all of its elements — the table's
    // rows. Built before the walk because an element's rows depend on its NEIGHBOURS' answers.
    const chosenByAxis = chosenMembers({
      elements: registered.elements,
      classificationOf: (element) => members.classificationFor(element),
      admits: (axis, member) => members.admits(axis, member),
      byElement,
    });
    // The ordinals each typed axis is answered at, and what names them (task 36.6). Built over
    // EVERY element of the version, not the step's — a B5 row exists because B1 named a site.
    const rowsByAxis = answeredRows({
      elements: registered.elements,
      typedAxisOf: (element) => element.axes.find(isTyped) ?? null,
      byElement,
      defaults,
    });
    const fields = registered.elements
      // Membership, not equality: eight of B3's seventeen are presented in C3 as well (task 36.4).
      .filter((element) => element.modules.includes(query.module))
      .flatMap((element) => {
        const verdict = applicability.get(element.key);
        const resolved = {
          catalogue,
          standing,
          help: this.labels.help({ ...at, key: element.key }),
          options: options.optionsFor(element),
          // An element no rule names applies, always — the artefact holds conditions, not verdicts.
          applicable: verdict?.applicable ?? true,
          applicabilityCause: toCause(verdict, catalogue),
          // Off the report rather than off the element: it is the filing's answer, one per workbook
          // as EFRAG's template carries it, and `toField` gives it only to the monetary kinds.
          currency: report.reportingCurrency,
        };
        const perOrdinal = defaults.get(element.key) ?? [];
        // Asked once per element and answered to the screen as well as used here: a typed axis is
        // what makes these rows a group the reporter can add to (task 36.2).
        const repeating = element.axes.some(isTyped);
        const typedAxis = repeating ? element.axes.find(isTyped) : undefined;
        const answered = typedAxis === undefined ? undefined : rowsByAxis.get(typedAxis);
        // The axis this element is *selected* along, where it has one (task 36.5). Collected as we
        // go, so the step carries each domain once rather than each field carrying a copy.
        const classification = members.classificationFor(element);
        if (classification !== null) classifications.add(classification);
        return rowsOf({
          element,
          repeating,
          members: members.membersFor(element),
          classification,
          chosen: classification === null ? [] : (chosenByAxis.get(classification) ?? []),
          // The axis's ordinals, which already fold in the snapshot's rows for every element on it.
          answeredOrdinals: [...(answered?.ordinals ?? [])],
          stored: byElement.get(element.key) ?? [],
          defaultRows: perOrdinal.length,
        }).map((row) => {
          const value = byKey.get(keyOf({ elementKey: element.key, ...row }));
          // A row in any state suppresses the default: cleared is a decision (§12.5.6, task 91.2).
          // **Defaults are per ordinal and a member-keyed group has none** — task 91.2 fills sites
          // and subsidiaries from the entity snapshot, and no snapshot knows a renewable-energy
          // figure. Reading `perOrdinal[0]` for every member would hand one element's default to
          // each of its columns.
          const defaultValue =
            value === undefined && row.dimensionKey === NO_DIMENSION
              ? (perOrdinal[row.ordinal] ?? null)
              : null;
          return toField(
            element,
            {
              ...row,
              value,
              defaultValue,
              repeating,
              // A member-keyed row is named by its member; a typed one by the report's own answer
              // for that ordinal (task 36.6). Both answer *what to call this row*, which is the one
              // question `dimensionLabel` carries.
              dimensionLabel: repeating
                ? (answered?.names.get(row.ordinal) ?? null)
                : members.labelFor(row.dimensionKey),
            },
            resolved,
          );
        });
      });

    return {
      module: query.module,
      taxonomyVersion: registered.version,
      fields,
      // The inputs of whatever this step's own fields are derived from. Resolved from the elements
      // actually on the step rather than from the whole artefact, so B9's hours figure appears on
      // B9 and nowhere else — a report has one of each, but a step is a screen.
      derivationInputs: derivationInputsFor({
        elements: fields.map((field) => field.elementKey),
        derivations: this.derivations.all({ standard: registered.standard }),
        stored: storedInputs,
      }),
      // Sorted, so two reads of one step agree — a `Set` preserves insertion order and the walk's
      // order is the taxonomy's, which is stable, but nothing in the type says so.
      axes: [...classifications]
        .sort()
        .flatMap((name) => {
          const axis = members.domainOf(name);
          return axis === null ? [] : [axis];
        }),
    };
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
    // **The template's own answers, under the entity's** (task 36.11). EFRAG ships B10's
    // minimum-wage affirmation already holding YES, and a value the template prints is EFRAG's
    // rather than this platform's — so it arrives as a `DisclosureDefault` like the entity record's
    // and is committed by the same outstanding-defaults path. The snapshot wins where both name an
    // element, which none do today: a fact about *this* undertaking beats an assumption the template
    // makes about every undertaking.
    const merged = new Map(defaults);
    for (const [element, value] of this.templateDefaults.all({ standard: registered.standard })) {
      if (!merged.has(element)) merged.set(element, [value]);
    }

    if (unmappedActivityCodes.length > 0) {
      this.warnings.warn(
        `Report ${report.id}: activity code(s) ${unmappedActivityCodes.join(', ')} have no member in ` +
          `${registered.standard} ${registered.version}'s NACE domain and were not pre-filled`,
      );
    }
    return merged;
  }

  /**
   * The modules this report has declared omitted (task 36.13; FR-31, UC-30, UX-29).
   *
   * Reads B1's `ListOfOmittedDisclosuresDeemedToBeClassifiedOrSensitiveInformation` — an ordinary
   * `enumeration_set`, so the selection is the stored value split on the member separator — and asks
   * the pure `omittedModules` what that makes omitted. **The domain comes from the registry rather
   * than from the stored answer**: *every section of this module is omitted* is a claim about the
   * standard's list, and computing it from what happens to be selected would make it vacuously true.
   */
  private omittedModules(input: {
    readonly registered: RegisteredTaxonomy;
    readonly byElement: ReadonlyMap<string, readonly DisclosureValue[]>;
  }): ReadonlySet<string> {
    const element = input.registered.elements.find((e) => e.key === OMITTED_DISCLOSURES_ELEMENT);
    // **Qualified, like every other domain lookup in this file.** The element names its domain
    // unqualified (`ListOfDisclosuresMember`) and the registry keys it by taxonomy
    // (`vsme:ListOfDisclosuresMember`) — the same trap `qualifiedDomainOf` exists for.
    const key = element === undefined ? null : qualifiedDomainOf(element);
    const domain = key === null
      ? null
      : this.taxonomy.enumeration({
          standard: input.registered.standard,
          version: input.registered.version,
          key,
        });
    if (domain === null) return new Set();
    const stored = input.byElement.get(OMITTED_DISCLOSURES_ELEMENT) ?? [];
    const selected = stored.flatMap((value) =>
      (value.valueText ?? '').split(MEMBER_SEPARATOR).filter((member) => member !== ''),
    );
    return omittedModules({ selected, domain: domain.members.map((member) => member.key) });
  }

  /**
   * FR-28's verdicts for this report, keyed by element (task 91.3) — for the elements a rule
   * governs, and for no others.
   *
   * The rules are read **as at today** rather than for the report's period, which is where this
   * differs from DR-4's version pin: UC-81 has a threshold change obliging review of reports
   * already open, and §12.5.6's task-91.3 row carries the argument.
   */
  private applicabilityOf(input: {
    readonly registered: RegisteredTaxonomy;
    readonly byElement: ReadonlyMap<string, readonly DisclosureValue[]>;
  }): ReadonlyMap<string, EvaluatedApplicability> {
    const rules = this.applicability.rulesFor({ standard: input.registered.standard });
    if (rules.length === 0) return new Map();
    return evaluateApplicability({
      rules,
      answers: input.byElement,
      ancestry: this.ancestryOf({ rules, ...input }),
    });
  }

  /**
   * The classification hierarchy a `member_within` rule walks — qualified member to qualified
   * parent, over the domains those rules actually name.
   *
   * **Built only where the driving field is answered.** NACE is 1 047 members and both wizard reads
   * evaluate on every request; an unanswered B1 activity decides the rule without any walk at all,
   * which is the common case for most of a report's life.
   */
  private ancestryOf(input: {
    readonly rules: readonly ApplicabilityRule[];
    readonly registered: RegisteredTaxonomy;
    readonly byElement: ReadonlyMap<string, readonly DisclosureValue[]>;
  }): MemberAncestry {
    const ancestry = new Map<string, string | null>();
    const at = { standard: input.registered.standard, version: input.registered.version };

    for (const rule of input.rules) {
      if (rule.condition.kind !== APPLICABILITY_CONDITION.MEMBER_WITHIN) continue;
      const answered = (input.byElement.get(rule.condition.elementKey) ?? []).some((value) =>
        isAnsweredState(value.state),
      );
      if (!answered) continue;

      const element = this.taxonomy.element({ ...at, key: rule.condition.elementKey });
      const domain = element === null ? null : qualifiedDomainOf(element);
      if (domain === null) continue;
      const enumeration = this.taxonomy.enumeration({ ...at, key: domain });
      if (enumeration === null) continue;
      for (const member of enumeration.members) {
        ancestry.set(
          `${enumeration.taxonomy}:${member.key}`,
          member.parent === null ? null : `${enumeration.taxonomy}:${member.parent}`,
        );
      }
    }
    return ancestry;
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
 * What one module's row is accumulated in while the elements are walked (task 91.3).
 *
 * Every inapplicable element's verdict is kept, duplicates included: what decides the module's own
 * announcement is how many *distinct* reasons its elements left for, and `soleCause` is what
 * answers that — here it is only collection.
 */
interface ModuleCount {
  answered: number;
  total: number;
  lastAnsweredAt: number | null;
  applicable: boolean;
  causes: EvaluatedApplicability[];
}

const newModuleCount = (): ModuleCount => ({
  answered: 0,
  total: 0,
  lastAnsweredAt: null,
  // False until an applicable element is met: a module whose every element a rule ruled out has
  // nothing to answer, and one with no elements at all never reaches the list.
  applicable: false,
  causes: [],
});

/**
 * The evaluated cause with its wording joined — the one place a driver key becomes a label.
 *
 * Separate from the evaluation because the evaluation is pure and locale-free: what a rule read is
 * a fact about the report, and what to call it is a fact about the reader (task 33.2).
 */
const toCause = (
  evaluated: EvaluatedApplicability | undefined,
  catalogue: Readonly<Record<string, DisclosureLabel>> | null,
): DisclosureApplicabilityCause | null =>
  evaluated === undefined
    ? null
    : {
        condition: evaluated.cause.condition,
        drivers: evaluated.cause.driverKeys.map((elementKey) => ({
          elementKey,
          label: catalogue?.[elementKey]?.text ?? null,
        })),
        threshold: evaluated.cause.threshold,
        answer: evaluated.cause.answer,
      };

/**
 * An element's domain as the registry keys enumerations — qualified (task 91.1).
 *
 * The artefact leaves a `vsme` domain unqualified on the element and qualifies every enumeration,
 * so the two readers of that rule — the option resolver and task 91.3's sector walk — share this
 * rather than each spelling it out.
 */
const qualifiedDomainOf = (element: TaxonomyElement): string | null =>
  element.domain === null
    ? null
    : element.domain.includes(':')
      ? element.domain
      : `${ENUMERATION_TAXONOMY.VSME}:${element.domain}`;

interface AxisRows {
  /** Every ordinal the axis has a row for — answered anywhere, or offered by the snapshot. */
  readonly ordinals: ReadonlySet<number>;
  /** What names each, where anything does. */
  readonly names: ReadonlyMap<number, string>;
}

/**
 * Which ordinals a report has answered on each **typed** axis, and what names each of them
 * (task 36.6).
 *
 * **Axis-wide, for `chosenMembers`' reason one axis kind over**: a typed axis identifies a *thing*,
 * and every element on it describes the same one. Per element the group goes ragged — measured:
 * `CityOfSite` three rows and `AddressOfSite` two — and a site answered in B1 never reaches B5,
 * which shares the axis since task 36.4's repair.
 *
 * **The name is the report's own answer, never the snapshot's.** §7.2 makes the snapshot *"the
 * default, never the authority"*, and task 91.3's applicability rule already reads B1's stored
 * answers to decide whether B5 applies at all — two mechanisms disagreeing about which sites exist
 * is what this avoids. The first `text` element on the axis with an answer, in the standard's own
 * presentation order, is what names the row: no per-axis naming vocabulary EFRAG does not state.
 * `enumeration` is excluded because it stores a member key, and a key may not reach a reader.
 */
function answeredRows(input: {
  readonly elements: readonly TaxonomyElement[];
  readonly typedAxisOf: (element: TaxonomyElement) => string | null;
  readonly byElement: ReadonlyMap<string, readonly DisclosureValue[]>;
  readonly defaults: EntityDefaults;
}): ReadonlyMap<string, AxisRows> {
  const gathering = new Map<string, { ordinals: Set<number>; names: Map<number, string> }>();
  // Presentation order, so the FIRST element that has something names the row — the elements arrive
  // in it already, and relying on that is why no naming vocabulary is declared.
  for (const element of input.elements) {
    const axis = input.typedAxisOf(element);
    if (axis === null) continue;
    const standing = gathering.get(axis) ?? { ordinals: new Set<number>(), names: new Map<number, string>() };
    gathering.set(axis, standing);
    const names = element.kind === DISCLOSURE_KIND.TEXT;

    // **What THIS element says about each ordinal, resolved before anything is named** (convention
    // review, 8 Sep 2026). Gathering across elements and rows in one pass made the name *last*-wins
    // within an ordinal, so a site with an address, a city and a GPS fix — which is every site once
    // the browser commits B1's defaults on arrival — was named by its coordinate pair, the one
    // outcome the presentation order exists to avoid. Neither test could see it: the api's names
    // came from defaults, which were already first-wins, and the browser fixture gives a site a
    // locality and nothing else.
    const shown = new Map<number, string>();

    // **The snapshot's rows count for the whole axis, not just the element it defaults** (task
    // 36.6). B1's `AddressOfSite` is given two rows by the snapshot and B5's site elements none, so
    // reading the element's own defaults would show B5 one row for a two-site company — a site the
    // platform knows about is a site B5 must ask about, whether or not anyone has committed it yet.
    for (const [ordinal, value] of (input.defaults.get(element.key) ?? []).entries()) {
      standing.ordinals.add(ordinal);
      const text = value?.valueText ?? null;
      if (names && text !== null && text !== '') shown.set(ordinal, text);
    }

    // A stored answer replaces the default offered for the same element — **including by being
    // empty**, which is the step read's own rule twenty lines down: *a row in any state suppresses
    // the default, because cleared is a decision*. A site whose address the reporter deleted is not
    // still named by the address the snapshot proposed.
    for (const value of input.byElement.get(element.key) ?? []) {
      if (value.dimensionKey !== NO_DIMENSION) continue;
      standing.ordinals.add(value.ordinal);
      if (!names) continue;
      const text = value.valueText;
      if (text !== null && text !== '') shown.set(value.ordinal, text);
      else shown.delete(value.ordinal);
    }

    // First element in presentation order that has something wins, and keeps it.
    for (const [ordinal, text] of shown) if (!standing.names.has(ordinal)) standing.names.set(ordinal, text);
  }
  return gathering;
}

/**
 * Which members a report has chosen on each classification axis (task 36.5).
 *
 * **Axis-wide rather than per element**, because a classification's rows are a *table's* rows: the
 * reporter names a pollutant once and answers air, water and soil for it. An element with no stored
 * value under a chosen member still gets its cell, which is the difference between an empty cell and
 * a pollutant nobody named — and a distinction no client could make from per-element rows.
 *
 * Sorted, so the same report renders in the same order twice: the store's rows come back in
 * whatever order the query's plan chose, which is not an order at all.
 */
function chosenMembers(input: {
  readonly elements: readonly TaxonomyElement[];
  readonly classificationOf: (element: TaxonomyElement) => string | null;
  readonly admits: (axis: string, member: string) => boolean;
  readonly byElement: ReadonlyMap<string, readonly DisclosureValue[]>;
}): ReadonlyMap<string, readonly string[]> {
  const gathering = new Map<string, Set<string>>();
  for (const element of input.elements) {
    const axis = input.classificationOf(element);
    if (axis === null) continue;
    const members = gathering.get(axis) ?? new Set<string>();
    gathering.set(axis, members);
    for (const value of input.byElement.get(element.key) ?? []) {
      // **Checked against the axis's own domain** (spec review, 8 Sep 2026). Before this task a
      // stored key the axis does not declare was simply never read; a classification derives its
      // rows FROM the store, so without this an arbitrary string materialises as a visible row on
      // every element of the axis, labelled *unnamed*. The step read is not the place to repair
      // such a row — it is the place not to draw one.
      if (value.dimensionKey !== NO_DIMENSION && input.admits(axis, value.dimensionKey)) {
        members.add(value.dimensionKey);
      }
    }
  }
  return new Map([...gathering].map(([axis, members]) => [axis, [...members].sort()]));
}

/** One row of one element: §7.3's `(element, dimension, ordinal)` minus the element. */
interface FieldRow {
  readonly dimensionKey: string;
  readonly ordinal: number;
}

/**
 * Which rows a step shows for one element (task 91.2; **explicit axes since task 36.4**).
 *
 * Three shapes, and §7.3's key is what makes them one function rather than three:
 *
 * - **A typed axis is a repeating group, and its rows are its ordinals** — every ordinal the store
 *   holds plus one per site or subsidiary in the snapshot, in order, so a stored third site and a
 *   snapshotted first two render as three rows. Nothing in either is one empty row, as before, so
 *   the group is still answerable.
 * - **An explicit axis is a member-keyed group, and its rows are its members** — the axis's
 *   `defaultMember` first, then the domain's, each at ordinal 0. The default member leads because
 *   it is the member a fact carrying no dimension is taken to mean — the *total* line, so a reader
 *   meets the whole before its parts. **UC-21 is not the authority for that ordering**: step 1 names
 *   the split and no total, and orders nothing; the reason is the default member's own semantics.
 * - Everything else is one undimensioned row.
 *
 * **The two cannot combine and nothing here pretends they might**: no element in the registered
 * versions carries more than one axis, so a cross-product has no producer and inventing one would
 * be an abstraction with no member — checked against the artefact, not assumed.
 */
function rowsOf(input: {
  readonly element: TaxonomyElement;
  readonly repeating: boolean;
  readonly members: readonly string[];
  readonly classification: string | null;
  /** The members chosen anywhere on this element's classification axis, in a stable order. */
  readonly chosen: readonly string[];
  /** The ordinals anything on this element's typed axis is answered at, anywhere in the report. */
  readonly answeredOrdinals: readonly number[];
  readonly stored: readonly DisclosureValue[];
  readonly defaultRows: number;
}): readonly FieldRow[] {
  if (input.repeating) {
    // **The ordinals the AXIS is answered at, not this element's** (task 36.6). A typed axis
    // identifies a thing — this site, that subsidiary — and §7.3 makes the ordinal that identity,
    // so a row exists for the axis the moment any element on it is answered. Computed per element,
    // a reporter who added a third site by answering its city got `CityOfSite` three rows and
    // `AddressOfSite` two: a ragged group whose third address could not be entered at all. It is
    // task 36.5's classification rule on the other kind of axis, and it is what carries a site from
    // B1 into B5, which share this axis since task 36.4's repair.
    const ordinals = new Set<number>(input.answeredOrdinals);
    for (let ordinal = 0; ordinal < input.defaultRows; ordinal += 1) ordinals.add(ordinal);
    const rows = ordinals.size === 0 ? [0] : [...ordinals].sort((a, b) => a - b);
    return rows.map((ordinal) => ({ dimensionKey: NO_DIMENSION, ordinal }));
  }
  if (input.members.length > 0) {
    return input.members.map((dimensionKey) => ({ dimensionKey, ordinal: 0 }));
  }
  if (input.classification !== null) {
    // **The rows a report HOLDS, not the ones its axis admits** (task 36.5). A breakdown above is
    // answered for every member; a classification is selected from, so serving 94 pollutant rows
    // would ask a reporter to answer 94 questions to disclose one.
    //
    // **The members are the AXIS's, not this element's**, which is what makes the step a table
    // rather than three ragged lists. EFRAG's own B4 sheet is headed `Row ID │ Pollutant │ Emission
    // to air │ Emission to water │ Emission to soil`: a reporter who names ammonia is being asked
    // for all three amounts, so an element with nothing stored under a chosen member still gets its
    // cell. Keying on the element instead would serve air one row and water none, and no client
    // could tell that apart from a pollutant nobody had chosen.
    //
    // **One unassigned row where a report holds none**, exactly as the typed-axis branch serves
    // ordinal 0 for a report with no sites: the step has to *show* the question before it can be
    // answered, and a module whose fields appear only once something is stored can never be
    // started. `dimensionKey` empty on a dimensioned element reads as *no member chosen yet*, and
    // nothing may be written under it — the store learns of a row when a member and a value do.
    if (input.chosen.length === 0) return [{ dimensionKey: NO_DIMENSION, ordinal: 0 }];
    return input.chosen.map((dimensionKey) => ({ dimensionKey, ordinal: 0 }));
  }
  return [{ dimensionKey: NO_DIMENSION, ordinal: 0 }];
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
    readonly dimensionKey: string;
    readonly ordinal: number;
    readonly value: DisclosureValue | undefined;
    readonly defaultValue: DisclosureDefault | null;
    readonly repeating: boolean;
    readonly dimensionLabel: string | null;
  },
  resolved: {
    readonly catalogue: Readonly<Record<string, DisclosureLabel>> | null;
    readonly standing: string | null;
    readonly help: DisclosureLabel | null;
    readonly options: readonly DisclosureOption[] | null;
    readonly applicable: boolean;
    readonly applicabilityCause: DisclosureApplicabilityCause | null;
    /** The filing's own currency (task 36.12) — read by monetary elements and by no other kind. */
    readonly currency: string;
  },
): DisclosureField {
  const { catalogue, standing: fallbackStanding } = resolved;
  const { value } = row;
  const label = catalogue?.[element.key] ?? null;
  return {
    elementKey: element.key,
    dimensionKey: row.dimensionKey,
    dimensionLabel: row.dimensionLabel,
    // An unanswered field is `reported`: the reporter is the one who would answer it, and a
    // nullable origin would make every reader branch on a third case that means the default.
    origin: value?.origin ?? DEFAULT_DISCLOSURE_ORIGIN,
    ordinal: row.ordinal,
    kind: element.kind,
    periodType: element.periodType,
    axes: element.axes,
    repeating: row.repeating,
    order: element.order,
    label: label?.text ?? null,
    // The catalogue's own standing where the label resolved, the version's otherwise — so a field
    // whose wording is missing still says whose wording it would have been (NFR-24, UX-47).
    labelStanding: label?.standing ?? fallbackStanding,
    help: resolved.help?.text ?? null,
    options: resolved.options,
    defaultValue: row.defaultValue,
    valueNumeric: value?.valueNumeric ?? null,
    valueText: value?.valueText ?? null,
    valueBoolean: value?.valueBoolean ?? null,
    valueDate: value?.valueDate ?? null,
    unitCode: value?.unitCode ?? null,
    // What the standard admits, beside what the row holds (task 91.4). Straight off the
    // element: it is a property of the disclosure, not of this row or this reporter.
    unitCodes: element.unitCodes,
    // A monetary disclosure is stated in the filing's currency, which EFRAG's template carries once
    // per workbook (task 36.12). Every other kind answers `null` — a count has no currency, and a
    // ratio's divides out.
    currency: element.kind === DISCLOSURE_KIND.MONETARY ? resolved.currency : null,
    state: value?.state ?? DISCLOSURE_STATE.MISSING,
    notAvailableReason: value?.notAvailableReason ?? null,
    carriedForward: value?.carriedForward ?? false,
    // Every row of an element shares its verdict: FR-28's drivers are the report's answers, not
    // this row's, so a second site is as applicable as the first.
    applicable: resolved.applicable,
    applicabilityCause: resolved.applicabilityCause,
  };
}

/**
 * An element's member-keyed rows, and what to call each one (task 36.4).
 *
 * **Resolved once per axis, not once per field** — `OptionResolver`'s reason exactly: three B3
 * elements share `BreakdownOfEnergyConsumptionAxis`, so a per-field lookup would ask the registry
 * three times for one answer.
 *
 * **Which axes expand is configuration, not a property of the axis** (AD-4; the reasoning is on
 * `DISCLOSURE_AXIS_SHAPE_CONFIG_KIND`). An explicit axis says an element is reported along a fixed
 * domain and says nothing about how it is answered: energy's two members are a breakdown a reporter
 * fills, B4's 94 pollutants are a domain they pick from. Nothing in EFRAG's package tells them
 * apart, so an axis expands when the standard's registered shape says it does — and every axis
 * nobody has registered keeps the single undimensioned row it had before this task.
 */
class MemberResolver {
  private readonly cache = new Map<string, readonly string[]>();

  /** A classification's answerable members, per axis — see `answerable`. */
  private readonly leaves = new Map<string, readonly TaxonomyMember[]>();

  /** Built on first use and reused: one resolver for 256 names, not 256 resolvers. */
  private regions: Intl.DisplayNames | undefined;

  constructor(
    private readonly input: {
      readonly registered: RegisteredTaxonomy;
      readonly taxonomy: TaxonomyRegistry;
      readonly memberLabels: Readonly<Record<string, DisclosureLabel>> | null;
      readonly locale: Locale;
      readonly breakdownAxes: ReadonlySet<string>;
      readonly classificationAxes: ReadonlySet<string>;
    },
  ) {}

  /** The rows this element is reported along, `[]` where it is undimensioned, typed or a picker. */
  membersFor(element: TaxonomyElement): readonly string[] {
    const name = element.axes.find((axis) => this.input.breakdownAxes.has(axis));
    if (name === undefined) return [];
    const cached = this.cache.get(name);
    if (cached !== undefined) return cached;

    const axis = this.axis(name);
    // A typed axis registered as a breakdown is a contradiction the registry settles, not this: its
    // rows are identifiers the reporter supplies, so it keeps task 91.2's ordinals.
    const members =
      axis === null || axis.typed
        ? []
        : [
            ...(axis.defaultMember ? [axis.defaultMember] : []),
            ...axis.members.map((member) => member.key),
          ];
    this.cache.set(name, members);
    return members;
  }

  /**
   * The **classification** axis this element is reported along, or `null` (task 36.5).
   *
   * The complement of `membersFor`, over the same three shapes: an explicit axis nobody registered
   * as a breakdown is a domain the reporter *selects* from — B4's 94 pollutants, B7's 973 waste
   * categories — so its rows are the ones a report actually holds rather than one per member.
   *
   * **Typed axes are excluded here as well as there**, and for the same reason in the other
   * direction: a site is not chosen from a domain, it is named.
   */
  classificationFor(element: TaxonomyElement): string | null {
    const name = element.axes.find((axis) => this.input.classificationAxes.has(axis));
    if (name === undefined) return null;
    // A typed axis registered as a classification is a contradiction the registry settles, not
    // this — `membersFor`'s reason in the other direction: its rows are identifiers the reporter
    // supplies, so there is no domain to select from and it keeps task 91.2's ordinals.
    const axis = this.axis(name);
    return axis === null || axis.typed ? null : name;
  }

  /** The member's label in the request's locale; `null` for an undimensioned row. */
  labelFor(dimensionKey: string): string | null {
    if (dimensionKey === NO_DIMENSION) return null;
    return this.input.memberLabels?.[dimensionKey]?.text ?? null;
  }

  /**
   * One classification's domain, as the answers a picker offers.
   *
   * **The default member is deliberately NOT offered.** On a breakdown it leads, because it is the
   * total line a fact with no dimension is taken to mean; here it is the domain's own root — *Type
   * of pollutant* — and offering it would let a reporter file an amount against the category rather
   * than against a pollutant.
   */
  domainOf(name: string): DisclosureAxis | null {
    const axis = this.axis(name);
    if (axis === null || axis.typed) return null;

    /** The language a published name was shown in, where that is not the reader's (task 36.8). */
    let borrowed: Locale | null = null;
    const members = this.answerable(axis)
      .map((member) => {
        // The platform's own catalogue first, in the request's locale.
        const named = this.labelFor(member.key);
        const shape = { value: member.key, code: member.code, hazardous: member.hazardous };
        if (named !== null) return { ...shape, label: named };
        // Then the classification's own published name — its in-locale one where it has it, and
        // English otherwise, which for the EU List of Waste is every member.
        const own = member.labels[this.input.locale] ?? null;
        if (own !== null) return { ...shape, label: own };
        // Then the platform's own name, for a domain EFRAG *references* rather than words — B8's
        // 256 ISO 3166 codes, none of which is worded anywhere in the package (task 36.9). It is
        // resolved in the request's locale, so nothing is borrowed and the note below stays silent.
        const region = this.regionName(axis.memberTaxonomy, member.key);
        if (region !== null) return { ...shape, label: region };
        const english = member.labels[PUBLISHED_CLASSIFICATION_LOCALE] ?? null;
        if (english !== null) borrowed = PUBLISHED_CLASSIFICATION_LOCALE;
        // Never the member key, which is an XBRL identifier. The published code is the honest
        // middle step, as it is for an enumeration.
        return { ...shape, label: english };
      });

    return {
      key: name,
      label: axis.defaultMember === null ? null : this.labelFor(axis.defaultMember),
      members,
      memberLanguage: borrowed,
    };
  }

  /**
   * A country's name in the reader's language, for an axis whose members EFRAG only references
   * (task 36.9).
   *
   * `CountryOfEmploymentContractAxis` carries 256 ISO 3166 codes and **not one of them is worded**
   * anywhere in the package or the catalogues — B8's picker would otherwise offer `AD, AE, AF`. The
   * names are the platform's to give, and `Intl.DisplayNames` is where they already are: 255 of the
   * 256 resolve in all three live locales, from data every Node ships.
   *
   * **This is not the formatting NFR-26 governs, and it is not banned here.** That rule forbids a
   * *format pattern chosen at a call site*, and its `new Intl.*` selector is scoped to `apps/web`,
   * `apps/admin` and `packages/ui` — the tiers that render. A display name is a locale-derived
   * lookup, which is the thing NFR-26 asks for rather than the thing it prohibits, and it is
   * resolved here for the reason every other member name is: the api names, the screen renders.
   *
   * **`fallback: 'none'`, so an unresolvable code answers nothing rather than itself.** One member
   * needs it — `NT`, the Neutral Zone, withdrawn from ISO 3166 in 1993 and still in EFRAG's list —
   * and a label that is its own key is the shape the user-facing-text rule refuses. The picker then
   * falls back to the code as a *reference*, which is that rule's own permitted case.
   */
  private regionName(memberTaxonomy: EnumerationTaxonomy | null, code: string): string | null {
    if (memberTaxonomy !== ENUMERATION_TAXONOMY.COUNTRY) return null;
    this.regions ??= new Intl.DisplayNames([this.input.locale], { type: 'region', fallback: 'none' });
    // `of` throws on a structurally invalid code rather than answering `undefined`.
    try {
      return this.regions.of(code) ?? null;
    } catch {
      return null;
    }
  }

  /**
   * Does this axis admit that member as an **answer**? The domain's leaves, never a shape the store
   * happens to hold — and never a category (task 36.8).
   *
   * **One answer for three readers**, which is what the first version of the leaf rule was not: it
   * reached `domainOf`'s picker and left this and the write path accepting a category. A category
   * written by anything but the browser would then have drawn a row on every element of the axis
   * *and* been rendered `unnamed`, because the picker no longer carries it — a strictly worse
   * outcome than before the rule existed.
   */
  admits(name: string, member: string): boolean {
    const axis = this.axis(name);
    return axis !== null && this.answerable(axis).some((candidate) => candidate.key === member);
  }

  /**
   * The members of a classification a reporter may actually answer: its **leaves**.
   *
   * EFRAG says so in the workbook itself, on B7's waste table — *"Please select a Type of waste
   * (Hazardous or Non-Hazardous) rather than a category else an ERROR message will appear."* The EU
   * List of Waste is 973 members over three levels and only its 842 entries carry the hazard
   * classification B7 reports on.
   *
   * **Derived from parentage rather than registered**, because unlike an axis's *shape* this one is
   * in the artefact — and it is a no-op for a flat domain like B4's 94 pollutants. Cached per axis:
   * `admits` is asked once per stored row and would otherwise rebuild the parent set each time.
   */
  private answerable(axis: TaxonomyAxis): readonly TaxonomyMember[] {
    const cached = this.leaves.get(axis.key);
    if (cached !== undefined) return cached;
    const parents = new Set(axis.members.flatMap((m) => (m.parent === null ? [] : [m.parent])));
    const answerable = axis.members.filter((member) => !parents.has(member.key));
    this.leaves.set(axis.key, answerable);
    return answerable;
  }

  private axis(name: string): TaxonomyAxis | null {
    return this.input.taxonomy.axis({
      standard: this.input.registered.standard,
      version: this.input.registered.version,
      key: name,
    });
  }
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
    const key = qualifiedDomainOf(element);
    if (key === null) return [];
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
        .map(({ countryCode }) => ({
          value: qualify(countryCode.toUpperCase()),
          label: null,
          code: countryCode.toUpperCase(),
          // `null`, not `false`: a country is outside a classification that makes the distinction.
          hazardous: null,
        }));
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
        hazardous: member.hazardous,
        label:
          (member.code === null ? undefined : named.get(member.code)?.[this.input.locale]) ??
          member.labels[this.input.locale] ??
          // **Not marked as borrowed, and that is a decision** (spec review, 8 Sep 2026): this
          // fallback is per MEMBER, not per domain — most NACE classes are named in the reader's
          // language and a few are not — so a domain-level note would assert something false about
          // the classification as a whole. A per-member marker is a different mechanism and belongs
          // with whichever task first needs one; `architecture.md` §12.5.6 carries the reasoning.
          member.labels[PUBLISHED_CLASSIFICATION_LOCALE] ??
          null,
      }));
    }

    return enumeration.members.map((member) => ({
      value: qualify(member.key),
      code: member.code,
      hazardous: member.hazardous,
      label: this.input.memberLabels?.[member.key]?.text ?? null,
    }));
  }
}

/**
 * The derivation inputs a step should show — the ones feeding a figure this step actually carries.
 *
 * **Keyed off the step's own elements, not off the artefact.** A report has one
 * `HoursWorkedByOneFullTimeEmployee`, and it is B9's question; serving every registered input on
 * every step would put B8's three turnover figures on B2. A pure function so the ordering and the
 * offer-versus-answer distinction are unit-testable without a store.
 *
 * Sorted by key, so two reads of one step agree on the order — the artefact's own order is an
 * author's choice and nothing in the type says it is stable.
 */
export function derivationInputsFor(query: {
  readonly elements: readonly string[];
  readonly derivations: ReadonlyMap<string, Derivation>;
  readonly stored: ReadonlyMap<string, string>;
}): readonly DerivationInputField[] {
  const onThisStep = new Set(query.elements);
  const fields: DerivationInputField[] = [];
  for (const derivation of query.derivations.values()) {
    if (!onThisStep.has(derivation.element)) continue;
    for (const operand of Object.values(derivation.operands)) {
      // A disclosure operand is already a field of its own — B9's accident count is on the step
      // above this list, and B1's headcount is B1's question. Only the keyless ones belong here.
      if (operand.from !== OPERAND_SOURCE.INPUT) continue;
      fields.push({
        key: operand.key,
        derives: derivation.element,
        value: query.stored.get(operand.key) ?? null,
        offered: operand.fallback,
      });
    }
  }
  return fields.sort((a, b) => a.key.localeCompare(b.key));
}
