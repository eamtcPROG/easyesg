/**
 * What a generated disclosure descriptor *is* (task 34.2; AD-3, T-3).
 *
 * **Hand-written beside the generated modules, not inside them.** The generator emits one file per
 * taxonomy version and those files are never edited (DR-4); the vocabulary they are written against
 * belongs here, so a change to what a descriptor means is one edit rather than one per registered
 * version.
 */

/**
 * What a disclosure *is*, as a form and a validator branch on it.
 *
 * **Declared here and imported by `apps/api`'s taxonomy port, not mirrored.** §10.7 gives this
 * package the taxonomy model, and the first version of this file restated the port's vocabulary as a
 * hand-written union of ten literals — which the `no-restricted-syntax` selector refused, correctly:
 * a union has no runtime value, so every call site spells the member out again, and two copies of a
 * closed set drift with nothing able to see it.
 *
 * The unit-bearing XBRL types collapse to `NUMERIC`: a mass and a volume are the same control, a
 * number with a unit, and which units an element admits is the taxonomy's business rather than the
 * renderer's.
 */
export const DISCLOSURE_KIND = {
  TEXT: 'text',
  TEXT_BLOCK: 'text_block',
  BOOLEAN: 'boolean',
  DATE: 'date',
  YEAR: 'year',
  MONETARY: 'monetary',
  NUMERIC: 'numeric',
  PERCENT: 'percent',
  ENUMERATION: 'enumeration',
  ENUMERATION_SET: 'enumeration_set',
} as const;

export type DisclosureKind = (typeof DISCLOSURE_KIND)[keyof typeof DISCLOSURE_KIND];

/**
 * Which of §7.3's four typed value columns a kind is stored in.
 *
 * Beside the vocabulary rather than in the facade, per CLAUDE.md: *"an operation over a vocabulary
 * lives with the vocabulary, not with each caller"*. It is a total `Record`, so a kind added to
 * `DISCLOSURE_KIND` fails to compile until its column is decided — where a `switch` with a `default`
 * would silently file it as text.
 *
 * `year` is text rather than numeric on purpose: it is a calendar year and never arithmetic, and
 * storing it as a number is what makes 2026 render as "2 026" (`apps/web/CLAUDE.md`).
 */
export const VALUE_COLUMN = {
  NUMERIC: 'numeric',
  TEXT: 'text',
  BOOLEAN: 'boolean',
  DATE: 'date',
} as const;

export type ValueColumn = (typeof VALUE_COLUMN)[keyof typeof VALUE_COLUMN];

export const COLUMN_OF_KIND: Readonly<Record<DisclosureKind, ValueColumn>> = {
  [DISCLOSURE_KIND.TEXT]: VALUE_COLUMN.TEXT,
  [DISCLOSURE_KIND.TEXT_BLOCK]: VALUE_COLUMN.TEXT,
  [DISCLOSURE_KIND.BOOLEAN]: VALUE_COLUMN.BOOLEAN,
  [DISCLOSURE_KIND.DATE]: VALUE_COLUMN.DATE,
  [DISCLOSURE_KIND.YEAR]: VALUE_COLUMN.TEXT,
  [DISCLOSURE_KIND.MONETARY]: VALUE_COLUMN.NUMERIC,
  [DISCLOSURE_KIND.NUMERIC]: VALUE_COLUMN.NUMERIC,
  [DISCLOSURE_KIND.PERCENT]: VALUE_COLUMN.NUMERIC,
  [DISCLOSURE_KIND.ENUMERATION]: VALUE_COLUMN.TEXT,
  [DISCLOSURE_KIND.ENUMERATION_SET]: VALUE_COLUMN.TEXT,
};

/**
 * The three shapes a disclosure can hold, and the reason the facade is worth generating.
 *
 * A uniform `Record<string, unknown>` would compile at every call site and say nothing. These say
 * which of the three an element is, so a caller that treats a repeating group as a single value
 * fails to compile rather than reading row zero and looking correct.
 */

/** One value. The 109 elements of `2026-05-01` that carry no axis. */
export interface Scalar<T> {
  readonly holds: 'scalar';
  readonly value: T;
}

/**
 * One value per member of an explicit axis — energy split by renewable, emissions by pollutant,
 * headcount by country of employment contract.
 *
 * `M` is the axis's own member keys where the version declares them, and `string` for an axis whose
 * domain is published in another taxonomy: B7's waste axis draws the EU List of Waste, which the
 * registry resolves at runtime from a separately-versioned artefact, so the member set is not
 * knowable at generation time and pretending otherwise would be a narrower type than the truth.
 */
export interface Dimensioned<T, M extends string = string> {
  readonly holds: 'dimensioned';
  readonly value: T;
  readonly member: M;
}

/**
 * A row per site, subsidiary or material — an axis the standard types rather than enumerating, so
 * the reporter supplies the identifier and the rows are ordered by `ordinal`.
 */
export interface RepeatingGroup<T> {
  readonly holds: 'repeating';
  readonly value: T;
}

/** Anything a generated descriptor can hold. */
export type Holds = Scalar<unknown> | Dimensioned<unknown> | RepeatingGroup<unknown>;

/**
 * One generated disclosure: the element key the store is written against, and — carried in the type
 * rather than the value — what reading it gives back.
 *
 * **`H` is phantom.** The runtime object is three strings and a member list; the shape exists only
 * so `read` and `write` can be typed against a descriptor a caller names, which is what turns
 * `element_key` from a string a caller can misspell into one the compiler supplies.
 */
export interface Disclosure<H extends Holds = Holds> {
  /** The VSME XBRL element local name — NFR-2's vocabulary, and the store's own key (AD-3). */
  readonly key: string;
  readonly kind: DisclosureKind;
  /** The axis this element is reported along, or `null` where it carries none. */
  readonly axis: string | null;
  /** The members an explicit axis admits, `null` for a typed axis or an externally-published domain. */
  readonly members: readonly string[] | null;
  /** Phantom: never read, never written. Present so `H` is inferable from a descriptor. */
  readonly __holds?: H;
}

/** What reading a disclosure of shape `H` answers. */
export type ValueOf<H extends Holds> = H extends Scalar<infer T>
  ? T | null
  : H extends Dimensioned<infer T, infer M>
    ? Readonly<Partial<Record<M, T>>>
    : H extends RepeatingGroup<infer T>
      ? readonly T[]
      : never;

/** The shape a descriptor declares, recovered from the descriptor's own type. */
export type HoldsOf<D> = D extends Disclosure<infer H> ? H : never;
