import type { Locale } from '@easyesg/i18n';
import type { Finding } from '@easyesg/validation';
import { DISCLOSURE_KIND, MEMBER_SEPARATOR } from '@easyesg/vsme';
import {
  DOCUMENT_MODULE,
  DOCUMENT_VALUE,
  type DocumentFinding,
  type DocumentGap,
  type DocumentModule,
  type DocumentNarrative,
  type DocumentRow,
  type DocumentValue,
  type ReportDocument,
} from '@api/contracts/report-document.port';
import type { LegalDate } from '@api/contracts/types/time';
import {
  COMPARABILITY,
  PRIOR_PERIOD_AVAILABILITY,
  type PriorPeriodComparatives,
  type PriorPeriodValue,
} from '@api/modules/core/comparatives/models/prior-period-value.model';
import { DISCLOSURE_ORIGIN, DISCLOSURE_STATE } from '@api/modules/core/disclosure/models/disclosure-value.model';
import { scopeAsks, type ReportScope } from '@api/modules/core/disclosure/models/report.model';
import type { DisclosureField, DisclosureModuleSummary } from '@api/modules/core/disclosure/models/wizard-step.model';

/**
 * What the report's document prints, decided from what the screens already read (task 43; FR-48, UX-119;
 * `architecture.md` §12.5.6's task-43 row (c)) — pure, so every rule about a zero, a gap and an omission is a unit case.
 *
 * - **An answered field prints with its mark**: FR-30's nil return as a stated zero, FR-32's not-available answer with
 *   its reason. **An unanswered one prints only where an unresolved finding names it** — the run's view, which reads
 *   stored answers only, so a default the reporter never saved is not filed and is not printed.
 * - **Every module the report's scope asks has its page**, so the contents never skip one: **omitted whole, it prints
 *   its omission alone** (FR-31); **ruled out by the report's own answers, it says it does not apply** (FR-28); and
 *   **still waiting on B1, it is owed** and prints whatever of it applies, as the roll-up counts it (FR-41 item 2).
 *   A field the answers make inapplicable does not print — the standard does not ask it — and a disclosure a declared
 *   section withholds prints once, with the omission and no value (FR-31).
 * - **A figure stands beside the prior period's where the two are comparable** (FR-45), rounded to the places its unit
 *   is given (FR-29), and **an overridden one carries what it superseded, why and who** (UX-43; task 39.4).
 *
 * Nothing here words anything: the document's adapter words the model in its locale.
 */
export interface DocumentSources {
  readonly locale: Locale;
  readonly report: {
    readonly entityName: string;
    readonly fiscalYear: number;
    readonly periodStart: LegalDate;
    readonly periodEnd: LegalDate;
    readonly scope: ReportScope;
    readonly templateVersion: string;
    readonly taxonomyVersion: string;
    readonly reportingCurrency: string;
  };
  /** The registered version's modules in the standard's order, as the wizard's list reads them. */
  readonly modules: readonly ModuleStanding[];
  /** The fields of each module {@link modulesToRead} names, read in the document's language. */
  readonly steps: ReadonlyMap<string, readonly DisclosureField[]>;
  /** The elements a validation run would evaluate — what a declared section withholds is not among them. */
  readonly inScope: ReadonlySet<string>;
  readonly prior: Pick<PriorPeriodComparatives, 'availability' | 'prior' | 'values'>;
  /** The latest calculator run: its factor set's label and each computed figure — `null` where none has run. */
  readonly run: { readonly factorSet: string | null; readonly results: ReadonlyMap<string, string> } | null;
  /** The last validation run's findings — `null` where none has run. */
  readonly findings: readonly Finding[] | null;
  /** The places each unit's figures are rounded to (FR-29); a unit absent here keeps every digit. */
  readonly places: Readonly<Record<string, number>>;
}

type ModuleStanding = Pick<DisclosureModuleSummary, 'module' | 'applicable' | 'omitted' | 'applicabilityCause'>;

/** Ruled out with an answer to quote — one with no answer is waiting on B1, and still owed (FR-41 item 2). */
const isRuledOut = (module: ModuleStanding): boolean =>
  !module.applicable && module.applicabilityCause !== null && module.applicabilityCause.answer !== null;

/** The modules whose fields a document prints — those the scope asks, not omitted and not ruled out. */
export function modulesToRead(input: {
  readonly scope: ReportScope;
  readonly modules: readonly ModuleStanding[];
}): readonly string[] {
  return input.modules
    .filter((module) => scopeAsks({ scope: input.scope, module: module.module }) && !module.omitted && !isRuledOut(module))
    .map((module) => module.module);
}

/** The kinds a figure, and so a comparative, is printed for. Internal to this file. */
const FIGURE_KINDS: ReadonlySet<string> = new Set([
  DISCLOSURE_KIND.NUMERIC,
  DISCLOSURE_KIND.PERCENT,
  DISCLOSURE_KIND.MONETARY,
]);

const addressOf = (address: { readonly elementKey: string; readonly dimensionKey: string; readonly ordinal: number }) =>
  `${address.elementKey}|${address.dimensionKey}|${address.ordinal}`;

export function assembleReportDocument(sources: DocumentSources): ReportDocument {
  const placesOf = (unit: string | null): number | null =>
    unit !== null && sources.places[unit] !== undefined ? sources.places[unit] : null;
  const unresolved = new Set((sources.findings ?? []).map((finding) => addressOf(finding.field)));
  const priorByAddress = new Map<string, PriorPeriodValue>(
    sources.prior.availability === PRIOR_PERIOD_AVAILABILITY.AVAILABLE
      ? sources.prior.values
          .filter((value) => value.comparability === COMPARABILITY.COMPARABLE)
          .map((value) => [addressOf(value), value])
      : [],
  );

  const modules: DocumentModule[] = [];
  const gaps: DocumentGap[] = [];
  const omittedModules: string[] = [];
  /** Where each field of the report sits and what it is called — what names a finding. */
  const named = new Map<string, Pick<DocumentFinding, 'module' | 'label' | 'member'>>();

  for (const summary of sources.modules) {
    if (!scopeAsks({ scope: sources.report.scope, module: summary.module })) continue;
    if (summary.omitted) {
      omittedModules.push(summary.module);
      modules.push({ module: summary.module, standing: DOCUMENT_MODULE.OMITTED, narrative: [], rows: [] });
      continue;
    }
    if (isRuledOut(summary)) {
      modules.push({ module: summary.module, standing: DOCUMENT_MODULE.RULED_OUT, narrative: [], rows: [] });
      continue;
    }
    const narrative: DocumentNarrative[] = [];
    const rows: DocumentRow[] = [];
    const withheldShown = new Set<string>();
    for (const field of inPrintedOrder(sources.steps.get(summary.module) ?? [])) {
      const address = addressOf(field);
      if (!named.has(address)) named.set(address, { module: summary.module, label: field.label, member: field.dimensionLabel });
      if (!field.applicable) continue;

      if (!sources.inScope.has(field.elementKey)) {
        if (withheldShown.has(field.elementKey)) continue;
        withheldShown.add(field.elementKey);
        rows.push({
          label: field.label,
          member: null,
          value: { kind: DOCUMENT_VALUE.UNANSWERED },
          prior: null,
          unit: null,
          unresolved: false,
          withheld: true,
          override: null,
        });
        gaps.push({ module: summary.module, label: field.label, member: null, value: null, withheld: true });
        continue;
      }

      const isUnresolved = unresolved.has(address);
      const answer = answerOf(field, placesOf);
      if (answer === null && !isUnresolved) continue;
      const value: DocumentValue = answer ?? { kind: DOCUMENT_VALUE.UNANSWERED };

      if (field.kind === DISCLOSURE_KIND.TEXT_BLOCK && value.kind === DOCUMENT_VALUE.TEXT) {
        narrative.push({ label: field.label, text: value.text });
        continue;
      }
      const figure = FIGURE_KINDS.has(field.kind);
      rows.push({
        label: field.label,
        member: field.dimensionLabel,
        value,
        prior: figure ? priorOf(priorByAddress.get(address), field, placesOf) : null,
        unit: figure ? field.unitCode : null,
        unresolved: isUnresolved,
        withheld: false,
        override:
          field.origin === DISCLOSURE_ORIGIN.OVERRIDDEN
            ? {
                superseded: sources.run?.results.get(field.elementKey) ?? null,
                places: placesOf(field.unitCode),
                reason: field.explanation,
                person: field.overriddenBy?.name ?? null,
              }
            : null,
      });
      if (value.kind === DOCUMENT_VALUE.NOT_AVAILABLE) {
        gaps.push({ module: summary.module, label: field.label, member: field.dimensionLabel, value, withheld: false });
      }
    }
    modules.push({ module: summary.module, standing: DOCUMENT_MODULE.REPORTED, narrative, rows });
  }

  return {
    locale: sources.locale,
    undertaking: sources.report.entityName,
    fiscalYear: sources.report.fiscalYear,
    periodStart: sources.report.periodStart,
    periodEnd: sources.report.periodEnd,
    scope: sources.report.scope,
    templateVersion: sources.report.templateVersion,
    taxonomyVersion: sources.report.taxonomyVersion,
    factorSet: sources.run?.factorSet ?? null,
    priorYear:
      sources.prior.availability === PRIOR_PERIOD_AVAILABILITY.AVAILABLE ? (sources.prior.prior?.fiscalYear ?? null) : null,
    modules,
    gaps,
    omittedModules,
    findings:
      sources.findings === null
        ? null
        : sources.findings.map((finding) => ({
            ...(named.get(addressOf(finding.field)) ?? { module: null, label: null, member: null }),
            message: finding.message,
            params: finding.params,
          })),
  };
}

/**
 * Single disclosures in the standard's order, then each repeating group's rows by position — a site's fields together,
 * as S-07 lays them out (task 179.2). Grouped by axis first, so sites and subsidiaries do not interleave.
 */
function inPrintedOrder(fields: readonly DisclosureField[]): readonly DisclosureField[] {
  const singles = fields.filter((field) => !field.repeating);
  const axes = [...new Set(fields.filter((field) => field.repeating).map((field) => field.axes.join(' ')))];
  const grouped = axes.flatMap((axis) =>
    fields
      .map((field, index) => ({ field, index }))
      .filter(({ field }) => field.repeating && field.axes.join(' ') === axis)
      .sort((left, right) => left.field.ordinal - right.field.ordinal || left.index - right.index)
      .map(({ field }) => field),
  );
  return [...singles, ...grouped];
}

/** The answer a field holds, as the document prints it — `null` where it holds none. */
function answerOf(field: DisclosureField, placesOf: (unit: string | null) => number | null): DocumentValue | null {
  if (field.state === DISCLOSURE_STATE.NIL_RETURN) return { kind: DOCUMENT_VALUE.NIL_RETURN };
  if (field.state === DISCLOSURE_STATE.NOT_AVAILABLE) {
    return { kind: DOCUMENT_VALUE.NOT_AVAILABLE, reason: field.notAvailableReason };
  }
  const text = field.valueText === null || field.valueText.trim() === '' ? null : field.valueText;
  switch (field.kind) {
    case DISCLOSURE_KIND.NUMERIC:
    case DISCLOSURE_KIND.PERCENT:
      return field.valueNumeric === null
        ? null
        : { kind: DOCUMENT_VALUE.FIGURE, value: field.valueNumeric, places: placesOf(field.unitCode) };
    case DISCLOSURE_KIND.MONETARY:
      return field.valueNumeric === null
        ? null
        : {
            kind: DOCUMENT_VALUE.MONEY,
            value: field.valueNumeric,
            places: placesOf(field.unitCode),
            currency: field.currency,
          };
    case DISCLOSURE_KIND.YEAR:
      return text === null ? null : { kind: DOCUMENT_VALUE.YEAR, value: text };
    case DISCLOSURE_KIND.TEXT:
    case DISCLOSURE_KIND.TEXT_BLOCK:
      return text === null ? null : { kind: DOCUMENT_VALUE.TEXT, text };
    case DISCLOSURE_KIND.BOOLEAN:
      return field.valueBoolean === null ? null : { kind: DOCUMENT_VALUE.YES_NO, value: field.valueBoolean };
    case DISCLOSURE_KIND.DATE:
      return field.valueDate === null ? null : { kind: DOCUMENT_VALUE.DATE, date: field.valueDate };
    case DISCLOSURE_KIND.ENUMERATION:
    case DISCLOSURE_KIND.ENUMERATION_SET: {
      const chosen = (text ?? '').split(MEMBER_SEPARATOR).filter((member) => member !== '');
      if (chosen.length === 0) return null;
      const option = (value: string) => field.options?.find((candidate) => candidate.value === value);
      return {
        kind: DOCUMENT_VALUE.CHOICES,
        labels: chosen.map((value) => option(value)?.label ?? option(value)?.code ?? value),
      };
    }
  }
}

/** The prior period's figure for a field, where it holds one — a nil return printed as one. */
function priorOf(
  prior: PriorPeriodValue | undefined,
  field: DisclosureField,
  placesOf: (unit: string | null) => number | null,
): DocumentValue | null {
  if (prior === undefined) return null;
  if (prior.state === DISCLOSURE_STATE.NIL_RETURN) return { kind: DOCUMENT_VALUE.NIL_RETURN };
  if (prior.valueNumeric === null || prior.state === DISCLOSURE_STATE.NOT_AVAILABLE) return null;
  const places = placesOf(prior.unitCode ?? field.unitCode);
  return field.kind === DISCLOSURE_KIND.MONETARY
    ? { kind: DOCUMENT_VALUE.MONEY, value: prior.valueNumeric, places, currency: field.currency }
    : { kind: DOCUMENT_VALUE.FIGURE, value: prior.valueNumeric, places };
}
