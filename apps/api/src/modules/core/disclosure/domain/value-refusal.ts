import type { DomainError } from '@api/app/filters/domain.error';
import type { TaxonomyAxis, TaxonomyElement } from '@api/contracts/taxonomy-registry.port';
import {
  DerivedDisclosureNotWritableError,
  NotAvailableReasonRequiredError,
  NotAvailableReasonUnexpectedError,
  UnitNotAdmittedError,
  UnknownDisclosureDimensionError,
  UnknownDisclosureElementError,
} from '../errors/report.errors';
import { unitIsAdmitted } from '../models/admitted-unit';
import { admitsMember } from '../models/axis-leaves';
import type { DisclosureValueContents, DisclosureValueKey } from '../models/disclosure-value.model';
import { NOT_AVAILABLE_REASON, notAvailableReasonVerdict } from '../models/not-available-reason';

/** One value as a write receives it: the key without its report, and the contents. */
export interface ValueToJudge extends Omit<DisclosureValueKey, 'reportId'> {
  readonly contents: DisclosureValueContents;
}

/**
 * Why this value cannot be stored, or `null` (task 218) — **the checks a write makes of each value on its own**, in
 * the order they were added. Every one is about the value: the field it names, its member, a derived figure, its
 * reason, its unit. A refusal of the report — not found, no taxonomy, locked — is the use case's, not this.
 *
 * Out of `WriteDisclosureValues` because it is pure and it is the rule: what a field may not hold, judged with the
 * pinned version's elements and axes handed in, so each check is a unit case rather than a database round trip.
 */
export function valueRefusal(input: {
  readonly value: ValueToJudge;
  readonly known: ReadonlyMap<string, TaxonomyElement>;
  /** The axes the standard registers as breakdowns (`AxisShapes`). */
  readonly breakdowns: ReadonlySet<string>;
  /** The elements a registered derivation computes. */
  readonly derived: ReadonlySet<string>;
  readonly axisOf: (key: string) => TaxonomyAxis | null;
}): DomainError | null {
  const { value } = input;
  // **Every element is checked against the report's OWN pinned taxonomy** — a value under a key that version does
  // not name is a live row nothing reads (task 34.2's defect, one layer down).
  const element = input.known.get(value.elementKey);
  if (element === undefined) return new UnknownDisclosureElementError();

  // **And the dimension, since task 36.5.** A classification's rows are derived from the store, so a `dimension_key`
  // the element's axes do not declare draws a row. Checked here rather than trusted from the browser, which is P-4.
  // **A category is not an answer** (task 36.8), and **a breakdown admits the rows the step read serves, its total
  // included** (task 217) — both `models/axis-leaves.ts`'s rule, which the step read asks too.
  if (value.dimensionKey !== '') {
    const admits = element.axes.some((key) => {
      const axis = input.axisOf(key);
      return axis !== null && admitsMember({ axis, member: value.dimensionKey, breakdown: input.breakdowns.has(key) });
    });
    if (!admits) return new UnknownDisclosureDimensionError();
  }

  // **And a figure the platform derives is not the reporter's to write** (task 36.10, FR-29).
  if (input.derived.has(value.elementKey)) return new DerivedDisclosureNotWritableError();

  // **And the shape of each value, since task 183** (§12.5.6's task-182 authoring row (6)): a reason belongs to *not
  // available* and only to it, and a unit must be one the element admits where the standard states any.
  const verdict = notAvailableReasonVerdict(value.contents);
  if (verdict === NOT_AVAILABLE_REASON.MISSING) return new NotAvailableReasonRequiredError();
  if (verdict === NOT_AVAILABLE_REASON.UNEXPECTED) return new NotAvailableReasonUnexpectedError();
  if (!unitIsAdmitted({ unitCode: value.contents.unitCode, admitted: element.unitCodes })) {
    return new UnitNotAdmittedError();
  }
  return null;
}
