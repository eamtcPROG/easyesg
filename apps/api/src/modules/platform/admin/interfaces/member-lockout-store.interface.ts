/** Which member's lock, in which organization, and who is releasing it. */
export interface MemberLockoutRelease {
  readonly organizationId: string;
  readonly accountId: string;
  /** `adminAccountId` from `AdminRealmGuard` — the acquisition log's requester for the membership read. */
  readonly requesterId: string;
  readonly at: Date;
}

/** What a release found: the lock cleared, an account that was not locked, or no such member. */
export const MEMBER_LOCKOUT_RELEASE = {
  RELEASED: 'released',
  NOT_LOCKED: 'not_locked',
  NOT_A_MEMBER: 'not_a_member',
} as const;

export type MemberLockoutReleaseOutcome = (typeof MEMBER_LOCKOUT_RELEASE)[keyof typeof MEMBER_LOCKOUT_RELEASE];

/**
 * A-02's release of a locked tenant account (task 67.12; FR-209). **Two connections, by necessity**: whether the
 * account is the organization's member is a cross-tenant read only `esg_admin_ro` can make, logged as an acquisition
 * like every read of the record; the release itself is `identity.credential`'s own write, made as `esg_app` the way the
 * reset link makes it — the lock and the failure count cleared in one statement, and only where a lock is set.
 */
export interface MemberLockoutStore {
  release(release: MemberLockoutRelease): Promise<MemberLockoutReleaseOutcome>;
}

export const MEMBER_LOCKOUT_STORE = Symbol('MEMBER_LOCKOUT_STORE');
