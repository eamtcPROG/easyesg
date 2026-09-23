import type { MembershipRole } from '@api/modules/identity/membership/models/membership.model';

/**
 * A person with an active membership in an organization, as A-02's record lists them (task 167; §12.5.6's task-167
 * row) — who they are and how support reaches them, never what they report (FR-77, D-5).
 *
 * **Whether a phone was given, not the phone**: the number itself is read one person at a time, each read logged
 * (`DiscloseMemberPhone`), so a record opened for any other reason exposes no one's number.
 */
export interface OrganizationMember {
  readonly accountId: string;
  /** UX-137's derivation — both name parts, one, or the address. */
  readonly displayName: string;
  readonly email: string;
  readonly role: MembershipRole;
  readonly hasPhone: boolean;
}
