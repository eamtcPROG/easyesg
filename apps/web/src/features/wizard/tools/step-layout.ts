import { DISCLOSURE_STATE, type DisclosureField } from '@easyesg/contracts';

/**
 * How a step's fields lay out (task 36.2) — a flat list of questions, or a repeating group.
 *
 * **Pure, and separate from the rendering**, because the interesting cases are data shapes rather
 * than pixels: a two-site B1, a group whose rows are not contiguous in presentation order, an
 * explicit axis that must *not* become a group. Each is a line here and a contrivance in a browser.
 *
 * **A group is a typed axis's rows**, which is the api's `repeating` and never a guess: several
 * elements sharing an axis is true of four *fixed member* axes at `2026-05-01`, so the obvious
 * client-side heuristic would offer to add a pollutant row to a classification (`architecture.md`
 * §12.5.6, task 36.2).
 */

export const STEP_ENTRY = {
  FIELD: 'field',
  GROUP: 'group',
  BREAKDOWN: 'breakdown',
  CLASSIFICATION: 'classification',
} as const;

export type StepEntryKind = (typeof STEP_ENTRY)[keyof typeof STEP_ENTRY];

/** One question, standing on its own. */
export interface StepFieldEntry {
  readonly kind: typeof STEP_ENTRY.FIELD;
  readonly field: DisclosureField;
}

/** One row of a repeating group: the fields about one site, one subsidiary, one material. */
export interface StepGroupEntry {
  readonly kind: typeof STEP_ENTRY.GROUP;
  /** The typed axis these rows belong to — the group's identity, and what an added row extends. */
  readonly axis: string;
  readonly ordinal: number;
  readonly fields: readonly DisclosureField[];
}

/**
 * One element reported along every member of a breakdown axis — B3's energy consumption as its
 * total, its renewable part and its non-renewable part (task 36.4).
 *
 * **A third kind rather than a variant of `GROUP`, because the two group different things.** A
 * repeating group is *one row of several objects* — this site, that site — so its legend names a
 * position and the reporter may add another. A breakdown is *one question answered several ways*:
 * its legend names the element, its rows name members, and there is nothing to add, because the
 * standard fixes the members. Folding them together would need a flag on every branch that reads
 * one, which is the boolean-prop smell UX-89 names.
 */
export interface StepBreakdownEntry {
  readonly kind: typeof STEP_ENTRY.BREAKDOWN;
  /** The element these rows all answer — the group's identity and its legend. */
  readonly elementKey: string;
  readonly fields: readonly DisclosureField[];
}

/**
 * One row of a **classification**: the fields answered for one member the reporter chose (task 36.5).
 *
 * EFRAG's B4 sheet is the shape this draws — `Row ID │ Pollutant │ Emission to air │ Emission to
 * water │ Emission to soil`, over rows the reporter adds. So a row names a *member* and carries
 * every element on the axis, which is neither of the other two groupings:
 *
 * - a **repeating group** is one row of several objects, identified by its **position** — this site,
 *   that site — and the reporter names it in a text field;
 * - a **breakdown** is one question answered several ways, over members the standard **fixes**, so
 *   there is nothing to add and no picker;
 * - a **classification** is rows the reporter **selects** from a domain, so it has a picker *and* an
 *   add control, and its legend names the chosen member.
 *
 * A fourth kind rather than a flag on `GROUP`, on `BREAKDOWN`'s own precedent: the alternative is a
 * boolean on every branch that reads one, which is the smell UX-89 names.
 */
export interface StepClassificationEntry {
  readonly kind: typeof STEP_ENTRY.CLASSIFICATION;
  /** The axis these rows are chosen from — what the picker offers, and what an added row extends. */
  readonly axis: string;
  /**
   * The chosen member, or `''` for a row nobody has assigned one to yet.
   *
   * Empty on a *dimensioned* element is task 36.5's *no member chosen*, and is not the undimensioned
   * row an unaxed field carries — the difference is the axis, which the field names.
   */
  readonly dimensionKey: string;
  readonly fields: readonly DisclosureField[];
}

export type StepEntry = StepFieldEntry | StepGroupEntry | StepBreakdownEntry | StepClassificationEntry;

/** A group under construction — the one place `fields` is writable. */
interface Collecting {
  readonly kind: typeof STEP_ENTRY.GROUP;
  readonly axis: string;
  readonly ordinal: number;
  readonly fields: DisclosureField[];
}

/**
 * The step's entries in the standard's presentation order.
 *
 * **A group takes the position of its first field**, so the questions around it stay where EFRAG
 * puts them: B1's sites are contiguous in the taxonomy's order, but nothing guarantees that for
 * every module, and a group that jumped to the end would silently reorder the questionnaire.
 *
 * **Ordinals order within the axis, not within the step.** Row 2's fields may sort before row 1's
 * in raw presentation order (they share the same `order`), so grouping is by `(axis, ordinal)` and
 * the groups themselves are ordered by ordinal.
 */
export function layOutStep(
  fields: readonly DisclosureField[],
  /**
   * The axes a reporter **selects** rows from, from the step's own `axes` (task 36.5).
   *
   * Handed in rather than derived, because no property of a field says which of the three shapes
   * its axis is answered in: `repeating` distinguishes the typed one, and a *breakdown* and a
   * *classification* look identical on the wire — several elements, member-keyed rows. That is
   * `AxisShapes`' registered answer (AD-4), and a client-side guess is what task 36.2's header
   * already warns against.
   */
  classificationAxes: ReadonlySet<string> = new Set(),
): readonly StepEntry[] {
  // Mutable while collecting, `readonly` once returned: the same object is both the map's entry and
  // the list's, so a row's later fields reach a group already positioned in the step.
  const groups = new Map<string, Collecting>();
  const entries: StepEntry[] = [];

  // Breakdown rows collect by element: every row of one element shares its label and differs only
  // by member, so the element is the group and the member is the row (task 36.4).
  const breakdowns = new Map<string, { kind: typeof STEP_ENTRY.BREAKDOWN; elementKey: string; fields: DisclosureField[] }>();
  // Classification rows collect by MEMBER, across elements: one pollutant's air, water and soil are
  // one row of EFRAG's own table (task 36.5) — the transpose of a breakdown's grouping.
  const classifications = new Map<
    string,
    { kind: typeof STEP_ENTRY.CLASSIFICATION; axis: string; dimensionKey: string; fields: DisclosureField[] }
  >();

  for (const field of fields) {
    const selected = field.axes.find((axis) => classificationAxes.has(axis));
    // **Checked first, and before `dimensionKey`**, because a classification's unassigned row
    // carries an empty `dimensionKey` and would otherwise fall through to the undimensioned branch
    // — where it would render as a bare field with no picker and no way to name what it measures.
    if (selected !== undefined) {
      const key = `${selected}\u0000${field.dimensionKey}`;
      const standing = classifications.get(key);
      if (standing === undefined) {
        const row = {
          kind: STEP_ENTRY.CLASSIFICATION as typeof STEP_ENTRY.CLASSIFICATION,
          axis: selected,
          dimensionKey: field.dimensionKey,
          fields: [field],
        };
        classifications.set(key, row);
        entries.push(row);
      } else {
        standing.fields.push(field);
      }
      continue;
    }
    // **Checked before `repeating`, and the two cannot both hold**: the api gives a row either an
    // ordinal (typed axis) or a member (breakdown axis), never both, because no registered element
    // carries more than one axis. Reading them in this order means a future element that did would
    // render as a breakdown rather than as an unreadable half of each.
    if (field.dimensionKey !== '') {
      const standing = breakdowns.get(field.elementKey);
      if (standing === undefined) {
        const group = {
          kind: STEP_ENTRY.BREAKDOWN as typeof STEP_ENTRY.BREAKDOWN,
          elementKey: field.elementKey,
          fields: [field],
        };
        breakdowns.set(field.elementKey, group);
        entries.push(group);
      } else {
        standing.fields.push(field);
      }
      continue;
    }
    // A repeating field with no axis cannot happen — the flag *is* "on a typed axis" — but the
    // wire is data, and a group keyed on `undefined` would collect every such field into one.
    const axis = field.repeating ? field.axes[0] : undefined;
    if (axis === undefined) {
      entries.push({ kind: STEP_ENTRY.FIELD, field });
      continue;
    }
    const key = `${axis} ${field.ordinal}`;
    const standing = groups.get(key);
    if (standing === undefined) {
      const group: Collecting = { kind: STEP_ENTRY.GROUP, axis, ordinal: field.ordinal, fields: [field] };
      groups.set(key, group);
      entries.push(group);
      continue;
    }
    standing.fields.push(field);
  }

  // Rows of one axis are contiguous and in ordinal order, wherever the first of them landed: a
  // reporter reads *site 1, site 2*, not the standard's field-by-field interleaving.
  return reorderRows(entries);
}

function reorderRows(entries: readonly StepEntry[]): readonly StepEntry[] {
  const seen = new Set<string>();
  const ordered: StepEntry[] = [];
  for (const entry of entries) {
    // **Anything that is not a repeating group passes through where it stands.** This reordering
    // exists because one axis's ordinals interleave in the standard's presentation order; a
    // breakdown's rows are one element's and arrive contiguous already, so gathering them here
    // would move a question the standard placed deliberately.
    if (entry.kind !== STEP_ENTRY.GROUP) {
      ordered.push(entry);
      continue;
    }
    if (seen.has(entry.axis)) continue;
    seen.add(entry.axis);
    ordered.push(
      ...entries
        .filter((candidate): candidate is StepGroupEntry =>
          candidate.kind === STEP_ENTRY.GROUP && candidate.axis === entry.axis,
        )
        .sort((a, b) => a.ordinal - b.ordinal),
    );
  }
  return ordered;
}

/**
 * The ordinal a new row of this axis would take.
 *
 * One past the highest the step carries, never the count: a step showing rows 0 and 2 — which the
 * api produces where the reporter cleared row 1 — would otherwise write a second row 2 and the two
 * would collide on the store's natural key.
 */
export function nextOrdinal(entries: readonly StepEntry[], axis: string): number {
  const ordinals = entries.flatMap((entry) =>
    entry.kind === STEP_ENTRY.GROUP && entry.axis === axis ? [entry.ordinal] : [],
  );
  return ordinals.length === 0 ? 0 : Math.max(...ordinals) + 1;
}

/**
 * A blank row of an existing group, at `ordinal` — what *add a site* renders before anything is
 * typed into it.
 *
 * **Client-side, and stored only when answered.** Writing an empty row on the click would put a
 * `missing` row in the store for a site that may never be described, and the reporter would meet it
 * again on every later visit. The row exists in the screen; the store learns of it when a value
 * does, which is the same rule a served default follows (§12.5.6, task 91.2).
 */
export function blankRow(template: StepGroupEntry, ordinal: number): StepGroupEntry {
  return {
    kind: STEP_ENTRY.GROUP,
    axis: template.axis,
    ordinal,
    fields: template.fields.map((field) => ({
      ...field,
      ordinal,
      // **The template's IDENTITY is cleared along with its values** (convention review, 8 Sep
      // 2026). Until task 36.6 a typed row's `dimensionLabel` was always null, so there was nothing
      // here to copy; now it carries what the report calls that site, and an added row inherited it
      // — *Amplasament 3 — Orhei*, a site nobody has described wearing site 2's name. `blankCell`
      // twelve lines down clears exactly this for the other axis kind, which is where the shape
      // was noticed and not applied.
      dimensionLabel: null,
      valueNumeric: null,
      valueText: null,
      valueBoolean: null,
      valueDate: null,
      // A row added after a declared gap is not itself a declared gap: `state` and `unitCode` are
      // as much the template's answer as its values are.
      unitCode: null,
      state: DISCLOSURE_STATE.MISSING,
      notAvailableReason: null,
      carriedForward: false,
      // A new row is the reporter's, so it carries no pre-fill: the snapshot's sites are the rows
      // the api already served, and offering one here would put the same site on the screen twice.
      defaultValue: null,
    })),
  };
}

/**
 * The step's rows plus the ones the reporter added, each a blank copy of that axis's last row.
 *
 * **Here rather than in the component that calls it** (gate-integrity review, 3 Sep 2026): these two
 * decide where an added row lands and which row owns the add control, and as unexported locals in a
 * `.tsx` file they had no spec and no browser journey — the whole add-a-row flow was unguarded.
 *
 * Appended rather than inserted, at ordinals past the highest the api served, so an added row never
 * collides with a stored one on the natural key §7.3 gives a value.
 */
export function withAddedRows(
  entries: readonly StepEntry[],
  added: Readonly<Record<string, number>>,
): readonly StepEntry[] {
  return Object.entries(added).reduce<readonly StepEntry[]>((standing, [axis, count]) => {
    const rows = standing.filter(
      (entry): entry is StepGroupEntry => entry.kind === STEP_ENTRY.GROUP && entry.axis === axis,
    );
    const template = rows.at(-1);
    // **A classification's added row is not a repeating group's**, so the two are separate branches
    // rather than one with a flag: a typed axis's new row takes the next *ordinal*, and a
    // classification's takes no identity at all until the reporter picks a member.
    if (template === undefined) return withAddedClassificationRows(standing, axis, count);
    const start = nextOrdinal(standing, axis);
    const extra = Array.from({ length: count }, (_unused, index) => blankRow(template, start + index));
    // After the axis's own last row, so the group stays contiguous and the questions after it keep
    // the position EFRAG gives them.
    const at = standing.lastIndexOf(template) + 1;
    return [...standing.slice(0, at), ...extra, ...standing.slice(at)];
  }, entries);
}

/**
 * The classification rows the reporter added, each a member-less copy of that axis's last row.
 *
 * **Member-less, and that is the whole difference from `blankRow`.** A repeating group's new row is
 * *site 3* the moment it appears; a classification's new row is a question — *which pollutant?* —
 * and has no key until it is answered. So `dimensionKey` stays `''` and nothing is written under it
 * (§7.3 would take an empty dimension as the undimensioned row, which for a dimensioned element is
 * a fact the standard does not admit).
 */
function withAddedClassificationRows(
  entries: readonly StepEntry[],
  axis: string,
  count: number,
): readonly StepEntry[] {
  const rows = entries.filter(
    (entry): entry is StepClassificationEntry =>
      entry.kind === STEP_ENTRY.CLASSIFICATION && entry.axis === axis,
  );
  const template = rows.at(-1);
  if (template === undefined) return entries;
  const extra = Array.from({ length: count }, (): StepClassificationEntry => ({
    kind: STEP_ENTRY.CLASSIFICATION,
    axis,
    dimensionKey: '',
    fields: template.fields.map(blankCell),
  }));
  const at = entries.lastIndexOf(template) + 1;
  return [...entries.slice(0, at), ...extra, ...entries.slice(at)];
}

/**
 * One cell of an added classification row: the element's shape with nothing in it.
 *
 * `dimensionKey` is emptied along with the values, because this cell belongs to no member yet — a
 * copy carrying the template's member would write the new row's answers over the old row's.
 */
const blankCell = (field: DisclosureField): DisclosureField => ({
  ...field,
  dimensionKey: '',
  dimensionLabel: null,
  valueNumeric: null,
  valueText: null,
  valueBoolean: null,
  valueDate: null,
  unitCode: null,
  state: DISCLOSURE_STATE.MISSING,
  notAvailableReason: null,
  carriedForward: false,
  defaultValue: null,
});

/**
 * Every member the step's rows already report on one axis (task 36.5).
 *
 * The picker offers what is left, because two rows reporting one pollutant would collide on §7.3's
 * natural key — `(report, element, dimension, ordinal)` — and the second would silently overwrite
 * the first. Making it unrepresentable is the same move `ChoiceSet` makes for a set-valued answer.
 */
export function membersTaken(entries: readonly StepEntry[], axis: string): ReadonlySet<string> {
  return new Set(
    entries.flatMap((entry) =>
      entry.kind === STEP_ENTRY.CLASSIFICATION && entry.axis === axis && entry.dimensionKey !== ''
        ? [entry.dimensionKey]
        : [],
    ),
  );
}

/** The add control belongs to the axis's last row, so a table offers it once rather than per row. */
export function isLastClassificationRow(
  entries: readonly StepEntry[],
  row: StepClassificationEntry,
): boolean {
  const rows = entries.filter(
    (entry): entry is StepClassificationEntry =>
      entry.kind === STEP_ENTRY.CLASSIFICATION && entry.axis === row.axis,
  );
  return rows.at(-1) === row;
}

/** The add control belongs to the axis's last row, so a group offers it once rather than per row. */
export function isLastRow(entries: readonly StepEntry[], group: StepGroupEntry): boolean {
  const rows = entries.filter(
    (entry): entry is StepGroupEntry => entry.kind === STEP_ENTRY.GROUP && entry.axis === group.axis,
  );
  return rows.at(-1)?.ordinal === group.ordinal;
}
