/**
 * Where `AuthGuard` records that a member was active in an organization (FR-56's *last activity*; 28 Sep 2026).
 *
 * **A port of its own rather than a second method on `RequestIdentityStore`**, whose other reader is
 * `platform/push`'s socket admission: that one resolves a session and never writes, and would otherwise depend on
 * an operation it never calls. The read is one transaction by design, and this is a write the guard makes only
 * after it has chosen the membership the request acts through — which the read cannot know.
 */
export interface MemberActivityStore {
  /**
   * Record `at` as the membership's last activity, **unless** what is recorded is at or after `unlessSince` —
   * `member-activity.ts`'s grain, applied by the caller. A membership that has since ended, or an organization
   * whose row the request no longer reaches, records nothing and is not an error.
   */
  record(input: {
    readonly accountId: string;
    readonly membershipId: string;
    readonly organizationId: string;
    readonly at: Date;
    readonly unlessSince: Date;
  }): Promise<void>;
}

export const MEMBER_ACTIVITY_STORE = Symbol('MEMBER_ACTIVITY_STORE');
