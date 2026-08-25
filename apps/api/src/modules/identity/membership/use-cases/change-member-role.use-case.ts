import { wouldLeaveNoAdministrator } from '../domain/last-administrator';
import type { MembershipStore } from '../interfaces/membership-store.interface';
import { MEMBERSHIP_STATUS, type MembershipRole } from '../models/membership.model';
import { LastAdministratorError, MemberNotFoundError } from '../errors/membership.errors';
import type { Clock } from '@api/contracts/clock.port';

export interface ChangeMemberRoleCommand {
  readonly membershipId: string;
  readonly role: MembershipRole;
}

/**
 * UC-62 — change a user's role (FR-58) — **and UC-64, promotion to Organization Administrator
 * (FR-60), which is the same operation with a different target value.**
 *
 * Those two use cases are not collapsed carelessly. `use_cases.md` lists them separately because
 * their *business rules* differ, not their mechanism: UC-62 carries "effect on next request rather
 * than next login", UC-64 carries the single-admin lockout. A second use-case class calling this
 * one with `role` fixed would be the pass-through `CLAUDE.md` warns about, and it would put the
 * lockout rule in the promotion path — which is the one path that cannot cause a lockout. The rule
 * belongs where it bites, and `wouldLeaveNoAdministrator` is where.
 *
 * **FR-58's "immediate effect" needs no code here, and that is the point.** The role is read from
 * this row on every request (`AuthGuard`, task 28), so a demotion committed now binds on the
 * member's next request without them re-authenticating. Anything that cached the role into a
 * session or a token would have to be invalidated; nothing does, so nothing has to be.
 *
 * Setting a member's existing role again is permitted and writes nothing the audit trail records —
 * `core.capture_field_change` compares row images, so an idempotent PATCH produces no change row.
 */
export class ChangeMemberRole {
  constructor(
    private readonly store: MembershipStore,
    private readonly now: Clock,
  ) {}

  async execute(command: ChangeMemberRoleCommand): Promise<void> {
    const membership = await this.store.findMembership(command.membershipId);
    // A removed member is not a member: re-granting access is an invitation (UC-15, task 26.2),
    // which is a decision about a person rather than an edit to a row.
    if (membership === null || membership.status !== MEMBERSHIP_STATUS.ACTIVE) {
      throw new MemberNotFoundError();
    }

    if (
      wouldLeaveNoAdministrator({
        subjectRole: membership.role,
        resultingRole: command.role,
        activeAdministrators: await this.store.countActiveAdministrators(),
      })
    ) {
      throw new LastAdministratorError();
    }

    // The store answers false only if the row vanished between the read above and here, which
    // inside one request transaction it cannot. Treated as not-found rather than ignored, because
    // "cannot happen" is the assumption that stops holding when a later task changes the caller.
    if (!(await this.store.changeRole(command.membershipId, command.role, this.now()))) {
      throw new MemberNotFoundError();
    }
  }
}
