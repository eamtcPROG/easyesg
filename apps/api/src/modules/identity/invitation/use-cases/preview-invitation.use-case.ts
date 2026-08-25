import type { Clock } from '@api/contracts/clock.port';
import {
  INVITATION_STANDING,
  invitationStanding,
  type InvitationStanding,
} from '../domain/invitation-standing';
import type { InvitationBearerStore } from '../interfaces/invitation-bearer-store.interface';
import type { InvitedRole } from '../models/invitation.model';

export interface PreviewInvitationCommand {
  readonly token: string;
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
 * **There is no application-level throttle here, and that is a correction rather than an omission**
 * (§12.5.6's task-26.3 row). One was written and removed: §12.5.6's auth row names invitation
 * *accept*, not this, and the key it specifies — per (IP, account) — is unbuildable on a route whose
 * entire purpose is serving someone with no account. Keying it per IP alone made every invitee
 * behind one office NAT share a five-per-quarter-hour budget, so the sixth colleague to open their
 * invitation would be refused; the browser suite hit it on its second test. What bounds this route
 * is the edge's 60 req/min per IP, exactly as it bounds `/auth/register` and `/auth/verification-email`
 * — the two other unauthenticated token paths (OQ-53, OQ-55 record the same reasoning). Guessing is
 * bounded by arithmetic besides: the token is 256 bits.
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
    return this.store.run({ token: command.token, actorId: null }, async (tx) => {
      const now = this.now();
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
  }
}
