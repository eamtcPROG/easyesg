/**
 * An emission factor set as the calculator reads it (task 37; FR-34, FR-35, FR-71).
 *
 * **What a factor set is, and what it is not.** It is the published data a run applies: for each energy source, the
 * invoice units it may be entered in with each unit's conversion to MWh, and the emission factor per MWh (FR-34's
 * order — *"convert entered consumption to MWh, apply the active emission factor set"*). It is not the arithmetic,
 * which tasks 38.2 and 38.3 write as code, and not the wording: a source's and a unit's names are catalogue keys the
 * screen resolves (OQ-43), so registering a source ships its factor as data and its label with the release.
 *
 * **Decimal strings, never numbers** (§7.3, NFR-58): a factor travels from a JSON payload into a `numeric` result, and
 * a float on the way is how 0.000512 becomes 0.0005119999.
 */

/**
 * Which GHG Protocol scope a source's emissions fall in — the B3 field a run writes them into.
 *
 * **Location-based is named, not implied.** FR-34 computes Scope 2 by the location-based method alone at MVP, and a
 * grid-average factor is what makes a factor location-based; a market-based factor (a supplier's mix, a residual mix)
 * is a different datum for a different B3 element, and arrives as a member of its own rather than as this one reused.
 */
export const GHG_SCOPE = {
  /** Direct emissions from fuel the undertaking burns — B3's `GrossScope1GreenhouseGasEmissions`. */
  SCOPE_1: 'scope_1',
  /** Purchased energy at the grid-average factor — B3's `GrossLocationBasedScope2GreenhouseGasEmissions`. */
  SCOPE_2_LOCATION_BASED: 'scope_2_location_based',
} as const;
export type GhgScope = (typeof GHG_SCOPE)[keyof typeof GHG_SCOPE];

/** Is this unvalidated value one of the scopes? Beside the set, not retyped at each reader (CLAUDE.md). */
export const isGhgScope = (value: unknown): value is GhgScope =>
  typeof value === 'string' && (Object.values(GHG_SCOPE) as string[]).includes(value);

/**
 * The version a run records (FR-35, P-11): which country's set, and which revision of it.
 *
 * **The revision is the identity, not the label.** A revision of a configuration artefact is immutable once published
 * (`config.reject_published_edit()`) and unique per scope, so `(country, revision)` names one payload forever — the
 * guarantee NFR-19's replay rests on. The label an operator gives a set (`2026.1`) is what a reader is shown (UX-42),
 * and nothing stops two revisions sharing one.
 */
export interface FactorSetPin {
  /** The country whose set this is — the artefact's scope, ISO 3166 alpha-2 in lower case (`md`). */
  readonly country: string;
  readonly revision: number;
}

/** One energy source of a set. */
export interface FactorSource {
  /** The source's key — `natural_gas`, `electricity_grid` — and the catalogue path its name resolves by. */
  readonly key: string;
  readonly ghgScope: GhgScope;
  /** Tonnes of CO₂-equivalent per MWh of the source, as a decimal string. */
  readonly emissionFactor: string;
  /**
   * The units the source may be entered in, each with the MWh one of it amounts to — `m3` → `0.00928…` for natural
   * gas. FR-33's invoice units: what the bill reads, so the reporter never converts.
   */
  readonly units: ReadonlyMap<string, string>;
  /**
   * Where the factor comes from — the publication, table and edition. An external authority's citation rather than
   * wording this project authored, which is why it is data (the reason NACE names are); printed beside the figure it
   * produced so a filed number stays explainable (NFR-35).
   */
  readonly reference: string;
}

/** A readable factor set: its pin, the name an operator gave it, and its sources in the order they were published. */
export interface FactorSet {
  readonly pin: FactorSetPin;
  readonly label: string;
  readonly sources: ReadonlyMap<string, FactorSource>;
}
