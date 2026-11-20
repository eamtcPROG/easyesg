import {
  TAXONOMY_COMPATIBILITY,
  TAXONOMY_FIELD_CHANGE,
  type TaxonomyCompatibility,
  type TaxonomyFieldChange,
} from '@api/contracts/taxonomy-mapping.port';

/**
 * The mapping between two registered taxonomy versions, and the backwards-compatibility determination held with it
 * (tasks 67.17, 67.21; FR-65, FR-67, FR-69; 182/39, 182/40; `architecture.md` §12.5.6's task-67.17 row).
 *
 * **A mapping records each field's kind of change alone** — added, removed or semantically altered (182/40) — and the
 * **determination is explicit**, compatible or breaking, held per pair (182/39): bulk or report-by-report migration is
 * a property of the pair being migrated, which FR-69 reads here. **The one consistency it is held to**: a pair that
 * removes or alters a field is breaking, since a report's answer to such a field cannot move unreviewed; a pair that
 * only adds may be either, which is the operator's to say. The two vocabularies are the mapping port's, which
 * `core/disclosure` reads too (task 67.20).
 */
export const FIELD_CHANGE = TAXONOMY_FIELD_CHANGE;

export type FieldChange = TaxonomyFieldChange;

export const COMPATIBILITY = TAXONOMY_COMPATIBILITY;

export type Compatibility = TaxonomyCompatibility;

export interface MappedField {
  /** The element's local name — present in `to` where added, in `from` where removed, in both where altered. */
  readonly element: string;
  readonly change: FieldChange;
}

export interface VersionMapping {
  readonly from: string;
  readonly to: string;
  readonly determination: Compatibility;
  readonly fields: readonly MappedField[];
}

const VERSION = /^\d{4}-\d{2}-\d{2}$/u;
const ELEMENT = /^[A-Za-z][A-Za-z0-9_]*$/u;

const isOneOf = <T extends string>(values: Readonly<Record<string, T>>, value: unknown): value is T =>
  typeof value === 'string' && (Object.values(values) as readonly string[]).includes(value);

/** The store scope of a pair's mapping — `<from>_<to>`, a seed file name's scope and an address segment. */
export const mappingScope = (pair: { readonly from: string; readonly to: string }): string => `${pair.from}_${pair.to}`;

/** Whether a determination is one the fields admit: removing or altering a field is breaking. */
export const determinationAdmitted = (input: {
  readonly determination: Compatibility;
  readonly fields: readonly MappedField[];
}): boolean =>
  input.determination === COMPATIBILITY.BREAKING ||
  input.fields.every((field) => field.change === FIELD_CHANGE.ADDED);

const readMapping = (payload: unknown): { readonly mapping: VersionMapping } | { readonly fault: string } => {
  if (typeof payload !== 'object' || payload === null) return { fault: 'is not an object' };
  const { from, to, determination, fields } = payload as Record<string, unknown>;
  if (typeof from !== 'string' || !VERSION.test(from)) return { fault: 'names no `from` version' };
  if (typeof to !== 'string' || !VERSION.test(to)) return { fault: 'names no `to` version' };
  if (from >= to) return { fault: 'does not map an earlier version to a later one' };
  if (!isOneOf(COMPATIBILITY, determination)) return { fault: 'states no determination' };
  if (!Array.isArray(fields)) return { fault: 'lists no fields' };

  const mapped: MappedField[] = [];
  for (const [index, entry] of (fields as unknown[]).entries()) {
    if (typeof entry !== 'object' || entry === null) return { fault: `field ${index + 1} is not an object` };
    const { element, change } = entry as Record<string, unknown>;
    if (typeof element !== 'string' || !ELEMENT.test(element)) return { fault: `field ${index + 1} names no element` };
    if (!isOneOf(FIELD_CHANGE, change)) return { fault: `field ${index + 1} states no kind of change` };
    if (mapped.some((known) => known.element === element)) return { fault: `${element} is mapped twice` };
    mapped.push({ element, change });
  }
  if (!determinationAdmitted({ determination, fields: mapped })) {
    return { fault: 'is compatible while it removes or alters a field' };
  }
  return { mapping: { from, to, determination, fields: mapped } };
};

/** A payload read as a mapping, or `null` — read whole or not at all. */
export const readVersionMapping = (payload: unknown): VersionMapping | null => {
  const read = readMapping(payload);
  return 'mapping' in read ? read.mapping : null;
};

/** Why the store refuses a payload of this kind, or `null` (`configuration-kind-rules.ts`), the seed included. */
export const versionMappingRefusal = (payload: unknown): string | null => {
  const read = readMapping(payload);
  return 'fault' in read ? `a taxonomy mapping the registry would not read: ${read.fault}` : null;
};

/** The facts about an element whose change alters what a stored answer means. */
const STRUCTURAL = ['kind', 'xbrlType', 'periodType', 'axes', 'unitCodes'] as const;

/**
 * The fields two versions' element tables differ by, structurally (task 67.21): an element only in `to` is added, only
 * in `from` removed, and in both with a different kind, type, period, axes or units altered. **A proposal, not the
 * mapping**: a field whose meaning changed under an unchanged shape is the operator's to mark altered, and the
 * determination is theirs to state. Sorted by element.
 */
export const structuralChanges = (input: {
  readonly from: Readonly<Record<string, Record<string, unknown>>>;
  readonly to: Readonly<Record<string, Record<string, unknown>>>;
}): readonly MappedField[] => {
  const changes: MappedField[] = [];
  const elements = [...new Set([...Object.keys(input.from), ...Object.keys(input.to)])].sort();
  for (const element of elements) {
    const before = input.from[element];
    const after = input.to[element];
    if (before === undefined) changes.push({ element, change: FIELD_CHANGE.ADDED });
    else if (after === undefined) changes.push({ element, change: FIELD_CHANGE.REMOVED });
    else if (STRUCTURAL.some((fact) => JSON.stringify(before[fact] ?? null) !== JSON.stringify(after[fact] ?? null))) {
      changes.push({ element, change: FIELD_CHANGE.ALTERED });
    }
  }
  return changes;
};
