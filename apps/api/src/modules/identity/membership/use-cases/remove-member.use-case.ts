import { wouldLeaveNoAdministrator } from '../domain/last-administrator';
import type { MembershipStore } from '../interfaces/membership-store.interface';
import { MEMBERSHIP_STATUS } from '../models/membership.model';
import { LastAdministratorError, MemberNotFoundError } from '../errors/membership.errors';
import type { Clock } from '@api/contracts/clock.port';

export interface RemoveMemberCommand {
  readonly membershipId: string;
}

/**
 * UC-63 — remove a user from the organization (FR-59, FR-55).
 *
 * The postcondition is the interesting half: *"the user's account continues to exist; their
 * historical contributions remain attributed in the change history"*. Two mechanisms already
 * guarantee it and neither is here, which is why this use case is short. `core.field_change` carries
 * `actor_id` with no foreign key, so attribution survives; and no runtime role holds `DELETE` on
 * `identity.membership`, so this cannot become a delete however it is later edited (task 25.1).
 *
 * **The member's sessions are deliberately not revoked.** It reads like an omission and it is
 * AD-12 working: the role and the active organization are re-read from the membership on every
 * request, so the next request this person makes finds no active membership and is refused. Killing
 * their sessions would also sign them out of *other* organizations they belong to (FR-12), which
 * this administrator has no authority over.
 *
 * A single-field command is still an object (CLAUDE.md, "Conventions") — `execute({ membershipId })`
 * reads no worse than `execute(membershipId)` and is the one that survives the second field.
 */
export class RemoveMember {
  constructor(
    private readonly store: MembershipStore,
    private readonly now: Clock,
  ) {}

  async execute(command: RemoveMemberCommand): Promise<void> {
    const membership = await this.store.findMembership(command.membershipId);
    // Removing an already-removed member is not idempotent-and-fine here: S-16 acts on a list that
    // does not contain them, so reaching this is a stale screen, and answering 404 is what tells
    // the front end to refresh rather than to report success for something it did not do.
    if (membership === null || membership.status !== MEMBERSHIP_STATUS.ACTIVE) {
      throw new MemberNotFoundError();
    }

    if (
      wouldLeaveNoAdministrator({
        subjectRole: membership.role,
        resultingRole: null,
        activeAdministrators: await this.store.countActiveAdministrators(),
      })
    ) {
      throw new LastAdministratorError();
    }

    if (!(await this.store.removeMember(command.membershipId, this.now()))) {
      throw new MemberNotFoundError();
    }
  }
}
