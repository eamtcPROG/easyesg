/**
 * A-02's register (task 67.3; UC-69, FR-76) — account-level metadata about every organization on the
 * platform, and never report content (FR-77, D-5).
 *
 * **What a row carries is the project owner's decision (13 Sep 2026)**, recorded in `design_spec.md`
 * §5.2: name and IDNO to find an account, registration date, active entity count, report count, and
 * activity as the most recent sign-in by any active member. **Plan is absent on purpose** — no plan
 * records exist until billing ships and PA holds no billing authority — so there is no field here to
 * fill with a placeholder.
 */

/** The orderings the register offers — one at a time, as §4.6's sortable heads are single-select. */
export const ORGANIZATION_REGISTER_SORT = {
  NAME: 'name',
  REGISTERED: 'registered',
  ENTITIES: 'entities',
  REPORTS: 'reports',
  ACTIVITY: 'activity',
} as const;

export type OrganizationRegisterSort =
  (typeof ORGANIZATION_REGISTER_SORT)[keyof typeof ORGANIZATION_REGISTER_SORT];

export const isOrganizationRegisterSort = (value: string): value is OrganizationRegisterSort =>
  (Object.values(ORGANIZATION_REGISTER_SORT) as readonly string[]).includes(value);

export interface OrganizationRegisterQuery {
  /** Matched against the name anywhere and the IDNO as a prefix; `null` when nothing is searched. */
  readonly search: string | null;
  readonly sort: OrganizationRegisterSort;
  readonly descending: boolean;
  readonly skip: number;
  readonly take: number;
}

export interface OrganizationRegisterRow {
  readonly id: string;
  readonly name: string;
  /** Null until the organization's profile records one (task 29.3's identifiers are optional). */
  readonly idno: string | null;
  readonly registeredAt: Date;
  /** Active reporting entities; an archived one is history, not a current part of the account. */
  readonly entityCount: number;
  /** Reports in any status — a count, which is account-level; what a report holds is content. */
  readonly reportCount: number;
  /** The most recent sign-in by any active member; null when none has signed in. */
  readonly lastSignInAt: Date | null;
}

export interface OrganizationRegisterPage {
  readonly rows: readonly OrganizationRegisterRow[];
  /** Organizations the search admitted — what the pages are counted from. */
  readonly matched: number;
  /** Every organization — what tells an empty page whether nothing has registered or nothing matched. */
  readonly total: number;
}
