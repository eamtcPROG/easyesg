import type { DomainError } from '@api/app/filters/domain.error';
import type { TaxonomyAxis, TaxonomyElement } from '@api/contracts/taxonomy-registry.port';
import {
  BasisForPreparationFollowsScopeError,
  DerivedDisclosureNotWritableError,
  DisclosureOutOfScopeError,
  MemberNotOfferedError,
  NotAvailableReasonRequiredError,
  NotAvailableReasonUnexpectedError,
  UnitNotAdmittedError,
  UnknownDisclosureDimensionError,
  UnknownDisclosureElementError,
  YearNotWellFormedError,
} from '../errors/report.errors';
import { DISCLOSURE_KIND } from '@easyesg/vsme';
import { unitIsAdmitted } from '../models/admitted-unit';
import { admitsMember } from '../models/axis-leaves';
import { statesBasis } from './entity-defaults';
import { holdsOnlyOffered } from './offered-members';
import { B1_ELEMENT } from '../models/b1-element.model';
import type { DisclosureValueContents, DisclosureValueKey } from '../models/disclosure-value.model';
import { NOT_AVAILABLE_REASON, notAvailableReasonVerdict } from '../models/not-available-reason';
import { scopeAsks, type ReportScope } from '../models/report.model';
import { targetAxisOf, targetMembers, type TargetAxis } from '../models/target-axis';
import { modulesAskingRow } from './target-rows';

/**
 * A calendar year as the `year` kind holds it (task 79.3; NFR-34): four digits and nothing else — never an instant, and
 * never a number, which would print *2 023*.
 */
const CALENDAR_YEAR = /^\d{4}$/;

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
  /** The axes one module asks at a base and a target year (`AxisShapes`, task 79.3). */
  readonly targets: ReadonlyMap<string, TargetAxis>;
  /** The elements a registered derivation computes. */
  readonly derived: ReadonlySet<string>;
  /** The members each narrowed choice element offers (`OfferedMembers`, task 79.7); an element absent offers its domain. */
  readonly offered: ReadonlyMap<string, ReadonlySet<string>>;
  readonly axisOf: (key: string) => TaxonomyAxis | null;
  /** D-A's scope — which modules the report asks (task 78.1). */
  readonly scope: ReportScope;
  /**
   * B1's basis for preparation as that scope states it (`basisForPreparationOf`), or `null` where the pinned version
   * declares no such member — in which case nothing here judges the field (task 78.3).
   */
  readonly basisForPreparation: string | null;
}): DomainError | null {
  const { value } = input;
  // **Every element is checked against the report's OWN pinned taxonomy** — a value under a key that version does
  // not name is a live row nothing reads (task 34.2's defect, one layer down).
  const element = input.known.get(value.elementKey);
  if (element === undefined) return new UnknownDisclosureElementError();

  // **And the report's scope, since task 78.1** (§12.5.6's task-182 report-authoring row (11)): an element no module of
  // which the scope asks is a Comprehensive one on a Basic report. **Over its modules, never its first**: the eight
  // elements B3 and C3 share are Basic elements too (task 36.4), and stay writable whatever the scope. **Over the row's
  // modules since task 79.3**: their base and target years are C3's alone, so a Basic report refuses those rows of a B3
  // element and admits its reporting year.
  const asking = modulesAskingRow({ element, dimensionKey: value.dimensionKey, targets: input.targets });
  if (!asking.some((module) => scopeAsks({ scope: input.scope, module }))) {
    return new DisclosureOutOfScopeError();
  }

  // **And the dimension, since task 36.5.** A classification's rows are derived from the store, so a `dimension_key`
  // the element's axes do not declare draws a row. Checked here rather than trusted from the browser, which is P-4.
  // **A category is not an answer** (task 36.8), and **a breakdown admits the rows the step read serves, its total
  // included** (task 217) — both `models/axis-leaves.ts`'s rule, which the step read asks too.
  // **A target axis admits exactly its two years** (task 79.3): the step serves no other row, and a third — the axis's
  // own *currently stated* member — would be the reporting year written twice, once undimensioned and once not.
  if (value.dimensionKey !== '') {
    const target = targetAxisOf({ element, targets: input.targets });
    const admits =
      target !== null
        ? targetMembers(target).includes(value.dimensionKey)
        : element.axes.some((key) => {
            const axis = input.axisOf(key);
            return axis !== null && admitsMember({ axis, member: value.dimensionKey, breakdown: input.breakdowns.has(key) });
          });
    if (!admits) return new UnknownDisclosureDimensionError();
  }

  // **And a figure the platform derives is not the reporter's to write** (task 36.10, FR-29).
  if (input.derived.has(value.elementKey)) return new DerivedDisclosureNotWritableError();

  // **And a choice the field does not offer, since task 79.7** (§12.5.6's task-79.7 row): C7's rights are narrower than
  // the domain they are drawn from, and the step serves the narrower list — an answer naming another member is one the
  // template cannot hold.
  if (!holdsOnlyOffered({ valueText: value.contents.valueText, offered: input.offered.get(value.elementKey) })) {
    return new MemberNotOfferedError();
  }

  // **And B1's basis for preparation is the scope's, since task 78.3** (§12.5.6's task-78 row (1)): an answer stating
  // another option — or none — would make the filing state two bases. Opening B1 still commits the scope's own option,
  // which this admits; the scope is changed on the report, which rewrites the answer with it.
  if (
    value.elementKey === B1_ELEMENT.BASIS_FOR_PREPARATION &&
    input.basisForPreparation !== null &&
    !statesBasis({ contents: value.contents, basis: input.basisForPreparation })
  ) {
    return new BasisForPreparationFollowsScopeError();
  }

  // **And the shape of each value, since task 183** (§12.5.6's task-182 authoring row (6)): a reason belongs to *not
  // available* and only to it, and a unit must be one the element admits where the standard states any.
  const verdict = notAvailableReasonVerdict(value.contents);
  if (verdict === NOT_AVAILABLE_REASON.MISSING) return new NotAvailableReasonRequiredError();
  if (verdict === NOT_AVAILABLE_REASON.UNEXPECTED) return new NotAvailableReasonUnexpectedError();
  if (!unitIsAdmitted({ unitCode: value.contents.unitCode, admitted: element.unitCodes })) {
    return new UnitNotAdmittedError();
  }
  // **And a year is four digits** (task 79.3): stored as text, so nothing below would refuse *2O23*. A cleared field
  // holds nothing and is not judged.
  const year = value.contents.valueText;
  if (element.kind === DISCLOSURE_KIND.YEAR && year !== null && year !== undefined && !CALENDAR_YEAR.test(year)) {
    return new YearNotWellFormedError();
  }
  return null;
}
