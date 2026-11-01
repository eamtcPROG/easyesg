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
 * FR-15's profile — **the account**, since task 177: its name, its country and how the platform reaches it.
 *
 * **What a report prints is the reporting entity's** (FR-15 and FR-17 as amended, §12.5.6's task-177 row): the legal
 * form, the registered address and the report-cover contact left this record for `ReportingEntity`, as the identifiers
 * had with task 175. A report is about its entity, and nothing here reaches one.
 *
 * **The contact details are nullable, because S-04 need not collect them**: a founder who has not decided which address
 * the platform should write to is not blocked from creating the organization to find out.
 */
export interface Organization {
  readonly id: string;
  /** The account's name, shown to its members; the first reporting entity takes it at founding (task 175). */
  readonly name: string;
  /**
   * ISO 3166-1 alpha-2, upper case. It selects the legal-form and activity vocabularies the organization's entities
   * are held to (§7.2) — an account setting, not a line of an address, which is each entity's since task 177.
   */
  readonly countryCode: string;
  /** How the **platform** reaches the organization: verification, invitations, notifications. */
  readonly contactEmail: string | null;
  readonly contactPhone: string | null;
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
  readonly contactEmail: string | null;
  readonly contactPhone: string | null;
}>;
