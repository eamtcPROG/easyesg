import type { Clock } from '@api/contracts/clock.port';
import { ADMIN_INVITATION_STANDING } from '../domain/admin-invitation-standing';
import { ADMIN_TOTP_ISSUER, mintTotpSecret, totpEnrolmentUri } from '../domain/totp';
import { AdminInvitationNotAcceptableError } from '../errors/admin-invitation.errors';
import type { AdminInvitationBearerStore } from '../interfaces/admin-invitation-bearer-store.interface';
import {
  presentAdminInvitation,
  type PresentAdminInvitationCommand,
} from './preview-admin-invitation.use-case';

/** What A-20's enrolment step draws: the secret, and the Key Uri its symbol encodes (§11.5). */
export interface AdminEnrolmentOffer {
  /** Base32 — typed into an authenticator where scanning is not an option. */
  readonly secret: string;
  readonly uri: string;
}

/**
 * A-20's second step (task 67.4): the second factor the account will be created with, staged on the
 * invitation until a code confirms it — **UC-68's precondition, *MFA enrolled*, met before the account
 * exists rather than after**, which is what keeps every account row holding a confirmed factor.
 *
 * **Asked twice, it answers the same secret** (`stageTotpSecret`'s contract), so reloading the step
 * after scanning does not silently invalidate the scan. Only a resend clears it, with the link.
 *
 * The URI carries the admin realm's issuer, `EasyESG Admin`, and the invited address as its label —
 * task 143's rule that a realm's factor names its own realm on the phone it is enrolled on.
 */
export class StageAdminEnrolment {
  constructor(
    private readonly store: AdminInvitationBearerStore,
    private readonly now: Clock,
  ) {}

  async execute(command: PresentAdminInvitationCommand): Promise<AdminEnrolmentOffer> {
    const at = this.now();
    const invitation = await presentAdminInvitation({ store: this.store, command, now: at });

    const secret =
      invitation.stagedTotpSecret ??
      (await this.store.run((tx) =>
        tx.stageTotpSecret({ invitationId: invitation.id, secret: mintTotpSecret(), at }),
      ));
    // Accepted or revoked between the gate and the write.
    if (secret === null) throw new AdminInvitationNotAcceptableError(ADMIN_INVITATION_STANDING.UNKNOWN);

    return {
      secret,
      uri: totpEnrolmentUri({ issuer: ADMIN_TOTP_ISSUER, email: invitation.email, secret }),
    };
  }
}
