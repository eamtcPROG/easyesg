import type { DisclosureField } from '@easyesg/contracts';

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

export const STEP_ENTRY = { FIELD: 'field', GROUP: 'group' } as const;

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

export type StepEntry = StepFieldEntry | StepGroupEntry;

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
export function layOutStep(fields: readonly DisclosureField[]): readonly StepEntry[] {
  // Mutable while collecting, `readonly` once returned: the same object is both the map's entry and
  // the list's, so a row's later fields reach a group already positioned in the step.
  const groups = new Map<string, Collecting>();
  const entries: StepEntry[] = [];

  for (const field of fields) {
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
    if (entry.kind === STEP_ENTRY.FIELD) {
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
      valueNumeric: null,
      valueText: null,
      valueBoolean: null,
      valueDate: null,
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
    if (template === undefined) return standing;
    const start = nextOrdinal(standing, axis);
    const extra = Array.from({ length: count }, (_unused, index) => blankRow(template, start + index));
    // After the axis's own last row, so the group stays contiguous and the questions after it keep
    // the position EFRAG gives them.
    const at = standing.lastIndexOf(template) + 1;
    return [...standing.slice(0, at), ...extra, ...standing.slice(at)];
  }, entries);
}

/** The add control belongs to the axis's last row, so a group offers it once rather than per row. */
export function isLastRow(entries: readonly StepEntry[], group: StepGroupEntry): boolean {
  const rows = entries.filter(
    (entry): entry is StepGroupEntry => entry.kind === STEP_ENTRY.GROUP && entry.axis === group.axis,
  );
  return rows.at(-1)?.ordinal === group.ordinal;
}
