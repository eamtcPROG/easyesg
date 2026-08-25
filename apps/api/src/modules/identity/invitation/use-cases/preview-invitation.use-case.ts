import type { Clock } from '@api/contracts/clock.port';
import {
  AUTH_ATTEMPT_LIMIT,
  AUTH_ATTEMPT_WINDOW_MS,
  invitationPreviewThrottleKey,
} from '@api/modules/identity/account/domain/auth-throttle';
import { AuthRateLimitedError } from '@api/modules/identity/account/errors/account.errors';
import {
  INVITATION_STANDING,
  invitationStanding,
  type InvitationStanding,
} from '../domain/invitation-standing';
import type { InvitationBearerStore } from '../interfaces/invitation-bearer-store.interface';
import type { InvitedRole } from '../models/invitation.model';

export interface PreviewInvitationCommand {
  readonly token: string;
  /** §12.5.6's throttle half. From the socket, resolved by the service — never from the body. */
  readonly clientIp: string | undefined;
}

/**
 * What S-03 renders before anyone accepts anything — UC-15's opening (FR-11), task 26.2.
 *
 * The screen's stated content is "the inviting organization; the role being granted; the invited
 * email address, to which the invitation is bound", and its states include three distinguishable
 * recoverable errors. This answers both: a standing, and — only where there is one worth showing —
 * the three facts.
 *
 * **It is reachable signed out, and that is the point.** UC-15 step 2 has the invitee deciding
 * whether to create an account, and nobody decides that without being told who is asking. That
 * requirement is what made `app.current_invitation` necessary at all: no policy over
 * `app.current_user` can serve a caller who has no account yet.
 *
 * **It consumes nothing and writes nothing.** The invitation is spent by an explicit POST from an
 * authenticated caller, never by opening a link — the same property task 19 built the verification
 * flow around, and the reason a mail scanner following the URL cannot burn someone's invitation.
 *
 * **Details are withheld unless the invitation is acceptable.** A spent, revoked or expired
 * invitation answers its standing and nothing else. That is not enumeration defence — the caller
 * holds the token, so they already know an invitation existed — it is that an organization's name
 * is its own fact, and a link that leaked into a mailing-list archive should stop disclosing who
 * invited whom the moment it stops working.
 */
export interface InvitationPreview {
  readonly standing: InvitationStanding;
  /** Present only when `standing` is `acceptable`; see the header. */
  readonly details: {
    readonly organizationName: string;
    readonly invitedEmail: string;
    readonly role: InvitedRole;
  } | null;
}

export class PreviewInvitation {
  constructor(
    private readonly store: InvitationBearerStore,
    private readonly now: Clock,
  ) {}

  async execute(command: PreviewInvitationCommand): Promise<InvitationPreview> {
    const outcome = await this.store.run({ token: command.token, actorId: null }, async (tx) => {
      const now = this.now();

      // The only **unauthenticated** route in the system that answers a question about a token, so
      // it is where one would be probed. §12.5.6 does not name it — it is this task's own route —
      // and the account half of its key is unbuildable, since serving someone with no account is
      // the whole point. Per IP, then, which is the degradation the social path already records.
      //
      // Counted and recorded before the read, and nothing here throws, so the row survives the
      // commit — the trap task 21 recorded and `AcceptInvitation` restates at length.
      const key = invitationPreviewThrottleKey(command.clientIp);
      const since = new Date(now.getTime() - AUTH_ATTEMPT_WINDOW_MS);
      if ((await tx.countRecentAuthAttempts(key, since)) >= AUTH_ATTEMPT_LIMIT) return null;
      await tx.recordAuthAttempt(key, now);

      const invitation = await tx.findInvitation();
      const standing = invitationStanding(invitation, now);

      if (invitation === null || standing !== INVITATION_STANDING.ACCEPTABLE) {
        return { standing, details: null };
      }

      return {
        standing,
        details: {
          organizationName: invitation.organizationName,
          invitedEmail: invitation.invitedEmail,
          role: invitation.role,
        },
      };
    });

    // Null is the throttle's answer, thrown after the commit so the attempt row it just wrote
    // survives. Every other outcome is a preview, including the four unusable standings.
    if (outcome === null) throw new AuthRateLimitedError();
    return outcome;
  }
}
