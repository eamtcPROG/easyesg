/**
 * The organization as it crosses the store port — FR-13, FR-14, FR-15 (task 29.1). Not a TypeORM
 * entity (AD-14 constraint 1), and instants are `Date`: epoch-ms is the wire's representation,
 * converted at the DTO boundary (OQ-50).
 */

/**
 * The **shape** of an edge in FR-14's relationship graph — the `org_relationship_kind_known`
 * CHECK's vocabulary, mirrored here as the house `as const`.
 *
 * **This is the axis the database owns, and its twin is the axis the database must not own.** §7.2
 * splits FR-14 in two: the kind of edge is the shape of a graph and does not move with the
 * commercial model, so a fixed set is right and a CHECK enforces it. The *organization type* —
 * `direct_sme` at MVP, Advisor, Buyer and Licensee later — is NFR-9's axis, which requires a fourth
 * value to arrive with **zero schema migrations**, so it is a configuration key and appears in this
 * file nowhere. Writing it here as a fourth `as const` would be the migration NFR-9 forbids, spelled
 * as a constant.
 */
export const ORG_RELATIONSHIP_KIND = {
  PARENT: 'parent',
  CHILD: 'child',
  PEER: 'peer',
} as const;

export type OrgRelationshipKind =
  (typeof ORG_RELATIONSHIP_KIND)[keyof typeof ORG_RELATIONSHIP_KIND];

/**
 * FR-15's profile, plus the two facts UC-49 establishes at creation.
 *
 * **The address is flat, not nested, and the reason is the audit trail.** `core.field_change`
 * records one row per column that moved (FR-54), so the change history S-15 renders names
 * `registered_locality` and not `registered_address`. A nested wire object would give the same
 * organization two vocabularies — one an OA reads in the history, one their client sends — and the
 * mapping between them would be a rule somebody has to know.
 *
 * **Everything but `name` and `countryCode` is nullable, because S-04 does not collect it.** The
 * founding screen takes the legal name, the country and the contact details; legal form, registered
 * address and (in 29.2) the identifiers belong to S-15, filled in against an organization that
 * already exists. A non-nullable column no creation flow supplies can only be satisfied by
 * inventing a value.
 */
export interface Organization {
  readonly id: string;
  /** FR-15's *registered* name. The only field both UC-49 and UC-50 require. */
  readonly name: string;
  /**
   * ISO 3166-1 alpha-2, upper case. Not merely an address part: it selects the legal-form
   * vocabulary (§7.2), so it is a fact about the organization before it is a line of its address.
   */
  readonly countryCode: string;
  /** A configuration key, admitted against the vocabulary registered for `countryCode`. */
  readonly legalForm: string | null;
  /**
   * FR-16's **primary** entity identifier (OQ-18) — Moldova's thirteen-digit state identification
   * number. Null until S-15 records it: S-04 collects no identifiers, and what makes it required is
   * that B1 cannot be filed without it (task 40), not a constraint on this record.
   */
  readonly idno: string | null;
  /**
   * FR-16's optional additional identifier — the Legal Entity Identifier (ISO 17442), kept so B1
   * stays conformant for the banks and EU buyers who require one. Held by very few Moldovan SMEs,
   * which is precisely why OQ-18 declined to make it primary.
   */
  readonly lei: string | null;
  readonly registeredAddressLine1: string | null;
  readonly registeredAddressLine2: string | null;
  readonly registeredLocality: string | null;
  readonly registeredPostalCode: string | null;
  /** How the **platform** reaches the organization: verification, invitations, notifications. */
  readonly contactEmail: string | null;
  readonly contactPhone: string | null;
  /**
   * FR-15's report-cover contact (amended 29 Aug 2026, task 30.3) — the person a reader of the
   * **published report** contacts about its content.
   *
   * **A second contact, not a rename of the pair above**, and the distinction is the reason it is
   * two more columns: the platform writes to `contactEmail` *about* the organization, while this is
   * printed on the cover *of a document that leaves the platform*. In an SME the first is whoever
   * administers the account and the second is whoever will answer a bank's question about a figure
   * in B3, and those are routinely different people.
   */
  readonly reportContactName: string | null;
  readonly reportContactEmail: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  /**
   * Who last changed any field of this record, and when — FR-15's *attributed and timestamped*,
   * answered rather than merely recorded (task 30.3).
   *
   * **Read from `core.field_change`, never from a column this application maintains.** Task 14's
   * capture trigger already writes one row per field that moved, taking the actor from
   * `app.current_user`; a second attribution written by the use case would be two writers of one
   * fact, drifting with nothing to notice. `architecture.md` §12.5.6's task-30.3 row carries the
   * decision and what it declined.
   *
   * **Null is a real answer with two causes**, and neither is an error: a record whose trail has
   * been aged out of the retained partitions, and — since `actor_id` carries no foreign key by
   * design — a change made by an account that has since been erased (NFR-28). The screen states the
   * moment either way and simply does not name a person.
   */
  readonly lastChange: OrganizationChangeAttribution | null;
}

/**
 * One line of attribution: who, and when.
 *
 * The address rather than a name because registration collects none (`design_spec.md` OQ-16), and
 * `accountId` beside it because the address is display and the id is identity — S-12 (task 84) will
 * link a trail entry to the person, and matching on an address is how that breaks the day someone
 * changes theirs.
 */
export interface OrganizationChangeAttribution {
  readonly accountId: string | null;
  /** Null where the acting account no longer exists, or where the actor was the system. */
  readonly email: string | null;
  readonly at: Date;
}

/**
 * What UC-49 establishes. `name` and `countryCode` are required; the contact details are S-04's
 * third field and optional, since a founder who has not decided which address the platform should
 * write to should not be blocked from creating the organization to find out.
 */
export interface NewOrganization {
  readonly name: string;
  readonly countryCode: string;
  readonly contactEmail: string | null;
  readonly contactPhone: string | null;
}

/**
 * UC-50's edit, as a **patch**: a field absent from the object is unchanged, and an explicit `null`
 * clears it. The two are different requests and the type says so — `string | null | undefined`
 * would leave a reader working out which of the three a missing key means.
 */
export type OrganizationProfilePatch = Partial<{
  readonly name: string;
  readonly countryCode: string;
  readonly legalForm: string | null;
  readonly idno: string | null;
  readonly lei: string | null;
  readonly registeredAddressLine1: string | null;
  readonly registeredAddressLine2: string | null;
  readonly registeredLocality: string | null;
  readonly registeredPostalCode: string | null;
  readonly contactEmail: string | null;
  readonly contactPhone: string | null;
  readonly reportContactName: string | null;
  readonly reportContactEmail: string | null;
}>;
