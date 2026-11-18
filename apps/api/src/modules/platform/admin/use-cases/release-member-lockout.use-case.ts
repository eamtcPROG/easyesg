import type { Clock } from '@api/contracts/clock.port';
import { LockedMemberNotFoundError, MemberNotLockedError } from '../errors/organization-register.errors';
import { MEMBER_LOCKOUT_RELEASE, type MemberLockoutStore } from '../interfaces/member-lockout-store.interface';

export interface ReleaseMemberLockoutCommand {
  readonly organizationId: string;
  readonly accountId: string;
  /** The operator releasing — the acquisition log's requester (FR-79), from `AdminRealmGuard`. */
  readonly requesterId: string;
  /**
   * Why — UC-214's input, trimmed and 1 … 500 characters by the request DTO. **The route's audit row records it**
   * (`AuditInterceptor`, from the same body field), so the one row FR-209 behaviour 3 asks for carries it; nothing this
   * use case decides turns on it, so it reaches no store.
   */
  readonly reason: string;
}

/**
 * UC-214 (task 67.12; FR-209): a Platform Administrator releases a tenant account FR-4's lockout locked, from A-02's
 * record, so a person who cannot use the reset mail can sign in again.
 *
 * **It clears the lock and the failure count together**, so the person has the whole of FR-4's threshold back rather
 * than one attempt before locking again — FR-80 behaviour 6's shape. **An account that is not locked is refused**,
 * not answered as success: the route's audit row would otherwise record a release that did not happen. **No
 * support-access grant**: the release changes account state and no report content (FR-77). The reason travels with
 * the command and is written to the audit row by `AuditInterceptor`. No notice reaches the released person (182/1).
 */
export class ReleaseMemberLockout {
  constructor(
    private readonly store: MemberLockoutStore,
    private readonly now: Clock,
  ) {}

  async execute(command: ReleaseMemberLockoutCommand): Promise<void> {
    const outcome = await this.store.release({
      organizationId: command.organizationId,
      accountId: command.accountId,
      requesterId: command.requesterId,
      at: this.now(),
    });
    if (outcome === MEMBER_LOCKOUT_RELEASE.NOT_A_MEMBER) throw new LockedMemberNotFoundError();
    if (outcome === MEMBER_LOCKOUT_RELEASE.NOT_LOCKED) throw new MemberNotLockedError();
  }
}
