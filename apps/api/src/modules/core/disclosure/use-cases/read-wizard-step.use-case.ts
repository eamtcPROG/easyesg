import type { Locale } from '@easyesg/i18n';
import { isAnswered } from '@easyesg/validation';
import { MEMBER_SEPARATOR } from '@easyesg/vsme';
import type { DisclosureLabelResolver } from '@api/contracts/disclosure-label.port';
import type { RegisteredTaxonomy, TaxonomyRegistry } from '@api/contracts/taxonomy-registry.port';
import type { OrganizationVocabulary } from '@api/modules/core/organization/interfaces/organization-vocabulary.interface';
import { TAXONOMY_STANDARD } from '@api/modules/platform/taxonomy/constants/taxonomy.constants';
import { VOCABULARY_COUNTRY } from '../constants/classification.constants';
import { evaluateApplicability, type MemberAncestry } from '../domain/applicability';
import { toCause } from '../domain/applicability-cause';
import { chosenMembers } from '../domain/chosen-members';
import { derivationInputsFor } from '../domain/derivation-inputs';
import { toField } from '../domain/disclosure-field';
import { entityDefaults, type EntityDefaults } from '../domain/entity-defaults';
import { rowsOf } from '../domain/field-rows';
import { moduleSummaries } from '../domain/module-progress';
import { qualifiedDomainOf } from '../domain/qualified-domain';
import { recordSiteNames, showsRecordValue } from '../domain/record-provenance';
import { indexStored, keyOf, type StoredValues } from '../domain/stored-values';
import { answeredRows, withRecordSiteNames } from '../domain/typed-axis-rows';
import {
  DisclosureModuleNotFoundError,
  ReportNotFoundError,
  TaxonomyVersionUnavailableError,
} from '../errors/report.errors';
import type { ApplicabilityRules } from '../interfaces/applicability-rules.interface';
import type { AxisShapes } from '../interfaces/axis-shape.interface';
import type { DerivationInputStore } from '../interfaces/derivation-input-store.interface';
import type { Derivations } from '../interfaces/derivation.interface';
import type { DisclosureValueStore } from '../interfaces/disclosure-value-store.interface';
import type { OmissionSections } from '../interfaces/omission-sections.interface';
import type { ReportStore } from '../interfaces/report-store.interface';
import type { TemplateDefaults } from '../interfaces/template-default.interface';
import {
  APPLICABILITY_CONDITION,
  type ApplicabilityRule,
  type EvaluatedApplicability,
} from '../models/applicability.model';
import { B1_ELEMENT } from '../models/b1-element.model';
import { NO_DIMENSION, type DisclosureValue } from '../models/disclosure-value.model';
import type { EntitySnapshot } from '../models/entity-snapshot.model';
import { evaluationScope, rolledUpModules, type ReportEvaluationScope } from '../models/evaluation-scope';
import { OMITTED_DISCLOSURES_ELEMENT, omittedModules, withheldElements } from '../models/omission.model';
import type { Report } from '../models/report.model';
import type { DisclosureModuleSummary, DisclosureStep } from '../models/wizard-step.model';
import { MemberResolver } from './member-resolver';
import { OptionResolver } from './option-resolver';

/**
 * The operations of the vocabulary port this use case calls — a `Pick`, so it depends on no
 * operation it never calls (CLAUDE.md, Interface Segregation), and a spec fakes these, not five.
 */
export type WizardVocabulary = Pick<
  OrganizationVocabulary,
  'registeredLegalForms' | 'naceClassifierFor' | 'legalFormMemberFor'
>;

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

/**
 * Where a read's non-fatal findings go. **A one-method sink rather than a framework logger**,
 * because a use case may not import `@nestjs/common` (`domain-free-of-frameworks`); the module
 * hands in a `Logger`, and a spec hands in an array.
 */
export interface ReadWarnings {
  warn(message: string): void;
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
 *
 * **This class reads and composes; what it read is ruled on elsewhere** (task 133.2). It does what nothing below it
 * can — read the report, its pinned version, its stored answers and their configuration through its ports — and hands
 * the result to pure functions in `domain/`, one rule each, and to `MemberResolver` and `OptionResolver`, which read
 * the registry for one step.
 */
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
    private readonly derivations: Derivations,
    /** Where the reporter's answers to those inputs are kept — `core.report_derivation_input`. */
    private readonly derivationInputs: DerivationInputStore,
    /** The answers EFRAG's template ships a field already holding (task 36.11). */
    private readonly templateDefaults: TemplateDefaults,
    private readonly warnings: ReadWarnings,
    /**
     * Which elements each omittable section withholds (task 41.2; FR-31 AC-3), as configuration — the one read the
     * validation scope needs that the wizard's own did not, since a module's omission is derived from B1 alone.
     */
    private readonly omissionSections: OmissionSections,
  ) {}

  /** The persistent module list (UX-5), with how much of each module has been answered. */
  async modules(query: ReadModulesQuery): Promise<readonly DisclosureModuleSummary[]> {
    const { registered } = await this.pinned(query.reportId);
    const { byElement } = await this.stored(query.reportId);
    return moduleSummaries({
      elements: registered.elements,
      moduleOrder: registered.modules,
      applicability: this.applicabilityOf({ registered, byElement }),
      byElement,
      catalogue: this.labels.labels({ version: registered.version, locale: query.locale }),
      // UX-29's third state, derived from B1's own declaration rather than stored per module — VSME's
      // only omission ground, stated where ¶24(b) requires it (task 36.13).
      omitted: this.omittedModules({ registered, byElement }),
    });
  }

  /** One step: the module's fields, in the standard's presentation order, with their values. */
  async step(query: ReadStepQuery): Promise<DisclosureStep> {
    const { report, registered } = await this.pinned(query.reportId);
    // **A module the pinned version does not carry is not there** (task 183; §12.5.6's task-182 authoring row (6)). It
    // answered 200 with no fields, which a client cannot tell from a module whose every field is inapplicable — and
    // nothing below needs to run for an address that names nothing.
    if (!registered.modules.includes(query.module)) throw new DisclosureModuleNotFoundError();
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
    const { defaults, record, snapshot } = await this.defaultsFor(report, registered);
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
      admits: (candidate) => members.admits(candidate),
      byElement,
    });
    // The ordinals each typed axis is answered at, and what names them (task 36.6). Built over
    // EVERY element of the version, not the step's — a B5 row exists because B1 named a site.
    const rowsByAxis = withRecordSiteNames({
      rows: answeredRows({
        elements: registered.elements,
        typedAxisOf: (element) => element.axes.find(isTyped) ?? null,
        byElement,
        defaults,
      }),
      // The site axis as B1's address names it, rather than a key written here (task 180.3).
      siteAxis: registered.elements.find((element) => element.key === B1_ELEMENT.SITE_ADDRESS)?.axes.find(isTyped),
      names: recordSiteNames({ snapshot, record, stored: byElement }),
    });
    // Read once for the step: which elements are derived (task 38.4) and, below, the inputs they read.
    const derivations = this.derivations.all({ standard: registered.standard });
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
          derived: derivations.has(element.key),
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
          repeating,
          members: members.membersFor(element),
          classification,
          chosen: classification === null ? [] : (chosenByAxis.get(classification) ?? []),
          // The axis's ordinals, which already fold in the snapshot's rows for every element on it.
          answeredOrdinals: [...(answered?.ordinals ?? [])],
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
          // Whether the row shows what the company record gives — its default, or an answer still equal to it
          // (task 180.3). Against the record's own defaults, so neither the scope's nor the template's count.
          const fromRecord = showsRecordValue({
            elementKey: element.key,
            value,
            given: row.dimensionKey === NO_DIMENSION ? (record.get(element.key)?.[row.ordinal] ?? null) : null,
          });
          return toField(
            element,
            {
              ...row,
              value,
              defaultValue,
              fromRecord,
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
        derivations,
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

  /**
   * What a validation run evaluates over (task 41.2; FR-28, FR-31, FR-177; §12.5.6's task-41 row (4), (h)) — the
   * report's stored answers, and the elements in its scope with the modules each counts in.
   *
   * **Here, beside the wizard's own reads, because every input is this module's and is read the way they read it**:
   * the report's own pinned version, FR-28's verdicts from `applicabilityOf`, the modules B1 declares omitted from
   * `omittedModules` — and, which the wizard never needed, the elements a declared *section* withholds. A run and the
   * module list cannot then disagree about what a report asks; `evaluationScope` is the pure rule over them.
   */
  async evaluationScope(query: { readonly reportId: string }): Promise<ReportEvaluationScope> {
    const { report, registered } = await this.pinned(query.reportId);
    const { byElement } = await this.stored(query.reportId);
    const applicability = this.applicabilityOf({ registered, byElement });
    const inapplicable = new Set(
      [...applicability].flatMap(([key, verdict]) => (verdict.applicable ? [] : [key])),
    );
    // Ruled out with an answer to quote; one with none is waiting on B1, and its module is still owed (FR-41 item 2).
    const ruledOut = new Set(
      [...applicability].flatMap(([key, verdict]) =>
        !verdict.applicable && verdict.cause.answer !== null ? [key] : [],
      ),
    );
    const omitted = this.omittedModules({ registered, byElement });
    const withheld = withheldElements({
      selected: this.selectedOmissions(byElement),
      sections: this.omissionSections.sectionsFor({ standard: registered.standard }),
    });
    return {
      values: [...byElement.values()].flat(),
      scope: evaluationScope({
        elements: registered.elements,
        reportScope: report.scope,
        inapplicable,
        omittedModules: omitted,
        withheld,
      }),
      modules: rolledUpModules({
        elements: registered.elements,
        moduleOrder: registered.modules,
        reportScope: report.scope,
        omittedModules: omitted,
        ruledOut,
      }),
    };
  }

  private async stored(reportId: string): Promise<StoredValues> {
    return indexStored(await this.values.forReport({ reportId }));
  }

  /**
   * What the platform already knows, for the fields it can answer (task 91.2; FR-27, UX-109).
   *
   * The snapshot is the period's, the scope the report's, and the legal-form member the country's
   * configuration — three sources this tier joins, none of which the screen holds. A code the pinned
   * NACE domain has no member for is logged rather than refused (the owner's decision, §12.5.6).
   */
  private async defaultsFor(
    report: Report,
    registered: RegisteredTaxonomy,
  ): Promise<{
    /** Every default the step offers — the record's, the scope's and the template's. */
    readonly defaults: EntityDefaults;
    /** The record's and the scope's alone, before the template's are merged under them (task 180.3). */
    readonly record: EntityDefaults;
    readonly snapshot: EntitySnapshot | null;
  }> {
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
    return { defaults: merged, record: defaults, snapshot };
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
    // **Qualified, like every other domain lookup in this module.** The element names its domain
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
    return omittedModules({
      selected: this.selectedOmissions(input.byElement),
      domain: domain.members.map((member) => member.key),
    });
  }

  /** The members B1's omission list selects, as stored — an `enumeration_set`, split on the member separator. */
  private selectedOmissions(byElement: ReadonlyMap<string, readonly DisclosureValue[]>): readonly string[] {
    return (byElement.get(OMITTED_DISCLOSURES_ELEMENT) ?? []).flatMap((value) =>
      (value.valueText ?? '').split(MEMBER_SEPARATOR).filter((member) => member !== ''),
    );
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
      const answered = (input.byElement.get(rule.condition.elementKey) ?? []).some(isAnswered);
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
