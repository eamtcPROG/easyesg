import type { DisclosureLabel, LabelStanding } from '@easyesg/i18n';
import { isAnswered } from '@easyesg/validation';
import { DISCLOSURE_KIND } from '@easyesg/vsme';
import type { TaxonomyElement } from '@api/contracts/taxonomy-registry.port';
import {
  ANSWER_STATES,
  DEFAULT_DISCLOSURE_ORIGIN,
  EMPTY_DISCLOSURE_STATE,
  type DisclosureValue,
} from '../models/disclosure-value.model';
import type {
  DisclosureApplicabilityCause,
  DisclosureDefault,
  DisclosureField,
  DisclosureOption,
} from '../models/wizard-step.model';
import type { FieldRow } from './field-rows';

/** What the step read knows about one row before it becomes a field. */
export interface ResolvedRow extends FieldRow {
  readonly value: DisclosureValue | undefined;
  readonly defaultValue: DisclosureDefault | null;
  readonly fromRecord: boolean;
  readonly repeating: boolean;
  readonly dimensionLabel: string | null;
}

/** What the step read resolved once for the element, and every one of its rows shares. */
export interface ResolvedElement {
  readonly catalogue: Readonly<Record<string, DisclosureLabel>> | null;
  readonly standing: LabelStanding | null;
  readonly help: DisclosureLabel | null;
  readonly options: readonly DisclosureOption[] | null;
  readonly applicable: boolean;
  readonly applicabilityCause: DisclosureApplicabilityCause | null;
  /** The filing's own currency (task 36.12) — read by monetary elements and by no other kind. */
  readonly currency: string;
  /** Whether the derivation artefact computes this element (task 38.4). */
  readonly derived: boolean;
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
 *
 * **Pure: the join, and the projections it makes on the way** — an unanswered field's origin and state, and which
 * kinds carry a currency. Everything it joins was read before it is called.
 */
export function toField(element: TaxonomyElement, row: ResolvedRow, resolved: ResolvedElement): DisclosureField {
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
    derived: resolved.derived,
    explanation: value?.explanation ?? null,
    overriddenBy: value?.overriddenBy ?? null,
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
    helpStanding: resolved.help?.standing ?? null,
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
    // The answer's kind and nothing else (task 42.1; §12.5.6's task-42 row (a)): a field with no answer — no row, a row
    // holding nothing, or one stored `missing` before 182/17 — reads `ok`, since whether it matters is a rule's and a
    // verdict is a finding's (182/17). The wizard draws `MISSING VALUE` where a rule raises it, not on every blank.
    state:
      value !== undefined && isAnswered(value) && ANSWER_STATES.includes(value.state)
        ? value.state
        : EMPTY_DISCLOSURE_STATE,
    notAvailableReason: value?.notAvailableReason ?? null,
    carriedForward: value?.carriedForward ?? false,
    fromRecord: row.fromRecord,
    // Every row of an element shares its verdict: FR-28's drivers are the report's answers, not
    // this row's, so a second site is as applicable as the first.
    applicable: resolved.applicable,
    applicabilityCause: resolved.applicabilityCause,
  };
}
