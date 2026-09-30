import { B1_ELEMENT } from '../models/b1-element.model';
import { DISCLOSURE_STATE, type DisclosureValue } from '../models/disclosure-value.model';
import type { EntitySnapshot } from '../models/entity-snapshot.model';
import type { DisclosureDefault } from '../models/wizard-step.model';
import type { EntityDefaults } from './entity-defaults';

/**
 * What in B1 still says what the company record said (task 180.3; FR-27, UX-109) — pure, and out of
 * `read-wizard-step.use-case.ts`, which task 133.2 is to split rather than grow.
 *
 * Two answers the step read gives beside a field: **whether the value shown is the record's** — the reader's
 * *from the company record* marker — and **which site rows keep the company's name for the site**. Both rest on one
 * comparison, made against the snapshot the period holds (FR-18, FR-27 as amended 30 Sep 2026), never the live entity.
 */

/**
 * The elements the **company record** answers — `B1_ELEMENT` without the basis for preparation, which is the report's
 * own scope (task 91.2's row) and so is not the company's to have said. The template's answers (B10's minimum-wage
 * affirmation) are not the record's either, and never reach here: the caller passes the record's defaults alone.
 */
const COMPANY_RECORD_ELEMENTS: ReadonlySet<string> = new Set(
  Object.values(B1_ELEMENT).filter((key) => key !== B1_ELEMENT.BASIS_FOR_PREPARATION),
);

/** A site's elements — what makes a site row the record's site. */
const SITE_ELEMENTS: readonly string[] = [
  B1_ELEMENT.SITE_ADDRESS,
  B1_ELEMENT.SITE_POSTAL_CODE,
  B1_ELEMENT.SITE_CITY,
  B1_ELEMENT.SITE_COUNTRY,
  B1_ELEMENT.SITE_GPS,
];

const NO_DIMENSION = '';

/** A default that gives something — a site the record holds no postal code for gives none, and marks nothing. */
const givesSomething = (given: DisclosureDefault): boolean =>
  given.valueText !== null || given.valueNumeric !== null || given.valueBoolean !== null || given.valueDate !== null;

/** Whether a stored answer still holds exactly what the record gave: the same columns, and answered rather than cleared. */
function holdsWhatWasGiven(value: DisclosureValue, given: DisclosureDefault): boolean {
  return (
    value.state !== DISCLOSURE_STATE.MISSING &&
    value.valueText === given.valueText &&
    value.valueNumeric === given.valueNumeric &&
    value.valueBoolean === given.valueBoolean &&
    value.valueDate === given.valueDate
  );
}

/**
 * Whether the field shows what the company record gives: the record's default not yet stored, or a stored answer
 * still equal to it. **Off once the reporter changes it**, and off for a field the record says nothing about.
 */
export function showsRecordValue(input: {
  readonly elementKey: string;
  readonly value: DisclosureValue | undefined;
  /** The record's own default for this row, or null where it gives none. */
  readonly given: DisclosureDefault | null;
}): boolean {
  if (!COMPANY_RECORD_ELEMENTS.has(input.elementKey) || input.given === null || !givesSomething(input.given)) {
    return false;
  }
  return input.value === undefined || holdsWhatWasGiven(input.value, input.given);
}

/**
 * The company's name for each site row the record gave and the reporter has not re-addressed — *Bakery and offices*
 * rather than its street (task 180.3, the owner's choice).
 *
 * **It amends task 36.6's *"the report's own answer, never the snapshot's"*, and only this far**: a site's name is not a
 * B1 element, so the report has no answer that could name the row by it. The name is used only while the row is still
 * the record's site — every site element the record gave is unstored or stored as given. A row whose address or town
 * the reporter changed, or cleared, is named as before, by its own answer, since it may no longer be the site the
 * record named. Filling in something the record did not give is not a change of site.
 *
 * Keyed by the snapshot's ordinal, which is the order B1's rows take (by name, then id).
 */
export function recordSiteNames(input: {
  readonly snapshot: EntitySnapshot | null;
  /** The record's own defaults, element by element. */
  readonly record: EntityDefaults;
  /** What the report stores, element by element. */
  readonly stored: ReadonlyMap<string, readonly DisclosureValue[]>;
}): ReadonlyMap<number, string> {
  const names = new Map<number, string>();
  for (const [ordinal, site] of (input.snapshot?.sites ?? []).entries()) {
    const name = site.name.trim();
    if (name === '') continue;
    const stillTheRecords = SITE_ELEMENTS.every((key) => {
      const given = input.record.get(key)?.[ordinal] ?? null;
      if (given === null || !givesSomething(given)) return true;
      const value = input.stored
        .get(key)
        ?.find((stored) => stored.ordinal === ordinal && stored.dimensionKey === NO_DIMENSION);
      return value === undefined || holdsWhatWasGiven(value, given);
    });
    if (stillTheRecords) names.set(ordinal, name);
  }
  return names;
}
