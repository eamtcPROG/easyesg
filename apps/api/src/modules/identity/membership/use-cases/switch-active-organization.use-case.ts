import { MembershipNotHeldError } from '../errors/membership.errors';
import type { SessionOrganizationStore } from '../interfaces/session-organization-store.interface';

export interface SwitchActiveOrganizationCommand {
  /** The signed-in account — ambient, resolved by the service, never taken from the wire. */
  readonly accountId: string;
  /** The session asking — ambient too, so a caller cannot name which session to move. */
  readonly sessionId: string;
  /** The organization to act for from the next request on. */
  readonly organizationId: string;
}

/**
 * UC-16's *switch* half (FR-12; task 83.1): the session acts for the organization chosen, from its
 * next request on.
 *
 * `design_spec.md` OQ-6 gives the behaviour to the global-tier switcher, and S-37 asks for it where
 * no organization is chosen; both reach this. **Nothing is reissued**: the access token names the
 * session and nothing of authorization consequence (AD-12), and `AuthGuard` reads the session's
 * choice on every request — so writing it is the whole of switching.
 *
 * **No read before the write.** Whether the account may act for the organization is decided by the
 * store's one statement, which is the only form in which the check and the write cannot disagree.
 * A choice of the organization already active is a success that changes nothing.
 */
export class SwitchActiveOrganization {
  constructor(private readonly store: SessionOrganizationStore) {}

  async execute(command: SwitchActiveOrganizationCommand): Promise<void> {
    const pointed = await this.store.pointSessionAt({
      sessionId: command.sessionId,
      accountId: command.accountId,
      organizationId: command.organizationId,
    });
    if (!pointed) throw new MembershipNotHeldError();
  }
}
