import { DISCLOSURE_KIND } from '@easyesg/vsme';
import type { TaxonomyElement } from '@api/contracts/taxonomy-registry.port';
import { NO_DIMENSION, type DisclosureValue } from '../models/disclosure-value.model';
import type { EntityDefaults } from './entity-defaults';

/**
 * A **typed** axis's rows — the sites, the subsidiaries — and what each is called (task 36.6; task 180.3).
 *
 * One idea in two steps: `answeredRows` finds every ordinal the axis has a row at and names each by the report's own
 * answer, and `withRecordSiteNames` lays the company's name for a site over that, where the company record still
 * gives it. The second only refines the first's answer, so they are read together.
 */

export interface AxisRows {
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
export function answeredRows(input: {
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
    // empty**, which is the step read's own rule: *a row in any state suppresses the default,
    // because cleared is a decision*. A site whose address the reporter deleted is not still named
    // by the address the snapshot proposed.
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
 * The site axis's rows named by the company's name for each site the record gave and the reporter has not
 * re-addressed (task 180.3; `record-provenance.ts` says which). Every other axis, and every other row, keeps the name
 * `answeredRows` gave it.
 */
export function withRecordSiteNames(input: {
  readonly rows: ReadonlyMap<string, AxisRows>;
  readonly siteAxis: string | undefined;
  readonly names: ReadonlyMap<number, string>;
}): ReadonlyMap<string, AxisRows> {
  const site = input.siteAxis === undefined ? undefined : input.rows.get(input.siteAxis);
  if (input.siteAxis === undefined || site === undefined || input.names.size === 0) return input.rows;
  const rows = new Map(input.rows);
  rows.set(input.siteAxis, { ordinals: site.ordinals, names: new Map([...site.names, ...input.names]) });
  return rows;
}
