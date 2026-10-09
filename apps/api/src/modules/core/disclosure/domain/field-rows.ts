import { NO_DIMENSION, type DisclosureValueKey } from '../models/disclosure-value.model';

/** One row of one element: §7.3's `(element, dimension, ordinal)` minus the element. */
export type FieldRow = Pick<DisclosureValueKey, 'dimensionKey' | 'ordinal'>;

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
export function rowsOf(input: {
  /** Whether the element is on a typed axis — a group the reporter adds rows to. */
  readonly repeating: boolean;
  /** The breakdown's members, default member first; `[]` where the element is on no breakdown. */
  readonly members: readonly string[];
  /** The classification axis the element is selected along, or `null`. */
  readonly classification: string | null;
  /** The members chosen anywhere on this element's classification axis, in a stable order. */
  readonly chosen: readonly string[];
  /** The ordinals anything on this element's typed axis is answered at, anywhere in the report. */
  readonly answeredOrdinals: readonly number[];
  /** How many rows the platform's defaults offer this element itself. */
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
