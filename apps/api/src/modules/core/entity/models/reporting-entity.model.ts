/**
 * The reporting entity and its sites — FR-17, FR-18, FR-20 (task 29.3). Not TypeORM entities
 * (AD-14 constraint 1), and instants are `Date`: epoch-ms is the wire's representation, converted
 * at the DTO boundary (OQ-50).
 */

/**
 * FR-20's two states — the `reporting_entity_status_known` CHECK's vocabulary.
 *
 * **Archiving removes an entity from active selection and keeps everything it produced.** So it is
 * a status change and never a delete, which is task 25.1's rule for memberships reaching its second
 * table: the row *is* the history, and UC-55 exists because prior filings must stay retrievable
 * after an entity is sold, merged or dissolved.
 *
 * There is no `restore`. No use case describes one and no screen offers it, so adding the state
 * transition would be inventing a flow — `archived` is terminal until something asks otherwise.
 */
export const ENTITY_STATUS = {
  ACTIVE: 'active',
  ARCHIVED: 'archived',
} as const;

export type EntityStatus = (typeof ENTITY_STATUS)[keyof typeof ENTITY_STATUS];

/**
 * One site an entity operates from — B1 discloses these and B5's applicability is evaluated from
 * their geolocations (BR-APP-3).
 *
 * **Coordinates are strings, not numbers, and that is AD-14 constraint 4.** The column is `numeric`
 * because NFR-58 forbids float, and a `numeric` crosses the driver boundary as a string; parsing it
 * into a JavaScript double here would reintroduce exactly the representation the column exists to
 * avoid. They stay strings until something needs to compute with them, and that something is task
 * 36.6's biodiversity determination.
 */
export interface Site {
  readonly id: string;
  readonly name: string;
  readonly addressLine1: string | null;
  readonly locality: string | null;
  readonly postalCode: string | null;
  readonly countryCode: string | null;
  /** Decimal degrees, `numeric(9,6)`. Null exactly when `longitude` is — the pairing is a CHECK. */
  readonly latitude: string | null;
  readonly longitude: string | null;
}

export interface ReportingEntity {
  readonly id: string;
  readonly name: string;
  /** A configuration key from the vocabulary registered for the organization's country. */
  readonly legalForm: string | null;
  /**
   * FR-17's "NACE code(s)" — plural, and an entity genuinely has several: a bakery that also runs a
   * café carries both. Admitted against the classifier registered for the country (CAEM Rev.2 for
   * Moldova), which is 1:1 with NACE to four characters, so what is stored is what B1 exports.
   */
  readonly naceCodes: readonly string[];
  readonly status: EntityStatus;
  /** Non-null exactly when `status` is `archived` — the `..._archived_at_matches_status` CHECK. */
  readonly archivedAt: Date | null;
  readonly sites: readonly Site[];
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/** What UC-52 establishes. Sites are optional at creation — an entity may be located later. */
export interface NewReportingEntity {
  readonly name: string;
  readonly legalForm: string | null;
  readonly naceCodes: readonly string[];
  readonly sites: readonly NewSite[];
}

export type NewSite = Omit<Site, 'id'> & { readonly id?: string };

/**
 * UC-53's edit, as a patch: a field absent is unchanged, an explicit `null` clears it.
 *
 * **`sites` is a whole-collection sync and says so by its type.** Absent leaves the sites alone;
 * present replaces the set — each member carrying an `id` is updated, each without one is inserted,
 * and a stored site the array omits is removed. That matches S-13's Record archetype, which saves
 * the whole record explicitly, and it keeps row identity for the sites that persist so FR-54's
 * trail records a *changed field* rather than a delete followed by an insert.
 */
export type ReportingEntityPatch = Partial<{
  readonly name: string;
  readonly legalForm: string | null;
  readonly naceCodes: readonly string[];
  readonly sites: readonly NewSite[];
}>;
