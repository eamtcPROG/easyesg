import type { Clock } from '@api/contracts/clock.port';
import { emailIdentityKey } from '@api/modules/identity/account/domain/email-address';
import {
  AUTH_ATTEMPT_LIMIT,
  AUTH_ATTEMPT_WINDOW_MS,
  invitationAcceptThrottleKey,
} from '@api/modules/identity/account/domain/auth-throttle';
import { AuthRateLimitedError } from '@api/modules/identity/account/errors/account.errors';
import {
  INVITATION_STANDING,
  invitationStanding,
  type UnacceptableStanding,
} from '../domain/invitation-standing';
import {
  InvitationNotAcceptableError,
  InvitationNotYoursError,
} from '../errors/invitation.errors';
import type { MembershipRole } from '@api/modules/identity/membership/models/membership.model';
import type {
  InvitationBearerStore,
  MembershipGrantKind,
} from '../interfaces/invitation-bearer-store.interface';

export interface AcceptInvitationCommand {
  readonly token: string;
  /** The signed-in acceptor, from `AuthGuard`. Resolved by the service, never sent by a caller. */
  readonly accountId: string;
  /** Their session, so acceptance can point it at the organization just joined. */
  readonly sessionId: string;
  /** §12.5.6's throttle half. From the socket, resolved by the service — never from the body. */
  readonly clientIp: string | undefined;
}

/**
 * What the transaction concluded, so the refusals can be thrown **after** it commits.
 *
 * Unexported and declared in this file, per CLAUDE.md's closed-vocabulary rule: it crosses no file
 * boundary and has exactly one reader, the same shape `RefreshSession`'s three-value outcome takes.
 *
 * **The indirection is not style, it is the throttle working.** `apps/api/CLAUDE.md` records the
 * trap from task 21: a use case that throws inside its own `run` rolls back everything the
 * transaction did — including the `identity.auth_attempt` row §12.5.6 requires — so every refusal
 * would cost the caller nothing and the limit would never bite. Throwing after the commit is what
 * `RequestPasswordReset` does, and for the same reason.
 */
const OUTCOME = {
  ACCEPTED: 'accepted',
  RATE_LIMITED: 'rate_limited',
  NOT_ACCEPTABLE: 'not_acceptable',
  ADDRESS_MISMATCH: 'address_mismatch',
} as const;

type Outcome =
  | { readonly kind: typeof OUTCOME.ACCEPTED; readonly accepted: AcceptedInvitation }
  | { readonly kind: typeof OUTCOME.RATE_LIMITED }
  | { readonly kind: typeof OUTCOME.NOT_ACCEPTABLE; readonly standing: UnacceptableStanding }
  | { readonly kind: typeof OUTCOME.ADDRESS_MISMATCH };

export interface AcceptedInvitation {
  readonly organizationId: string;
  readonly organizationName: string;
  /**
   * The role the acceptor **now holds** — the invitation's for a new or restored membership, and
   * their existing one where they were already a member (§12.5.6's task-26.2 row). Never the
   * invitation's role assumed to be theirs; see `MembershipGranted`.
   */
  readonly role: MembershipRole;
  readonly grant: MembershipGrantKind;
}

/**
 * UC-15 — accept an invitation to join an organization (FR-11), task 26.2.
 *
 * Framework-free, as `domain-free-of-frameworks` requires. Every branch below is reachable in a
 * unit test with a fake store and a closure for the clock, which is the point of paying that cost:
 * the paths that are *not* the happy one are this task's work, and there are five of them.
 *
 * **The whole acceptance is one transaction** (see the port's header): the invitation is consumed,
 * the membership is granted and the session is pointed at the new organization, or none of it
 * happens. Split in two, a crash between them spends the link and grants nothing — and the link is
 * the only copy, so the invitee cannot retry.
 *
 * **The order is checked, then written, and it matters.** Standing is read before the address is
 * compared so that a spent link tells the holder it is spent rather than telling them it was for
 * somebody else — two different sentences with two different resolutions, and the second would be
 * a false statement to a person who is in fact the invitee.
 */
export class AcceptInvitation {
  constructor(
    private readonly store: InvitationBearerStore,
    private readonly now: Clock,
  ) {}

  async execute(command: AcceptInvitationCommand): Promise<AcceptedInvitation> {
    const outcome = await this.store.run(
      { token: command.token, actorId: command.accountId },
      async (tx): Promise<Outcome> => {
        const now = this.now();

        // §12.5.6's auth-path row names invitation accept in terms. Counted then recorded before
        // any work, so a refusal below still spends the budget — which is the point of a throttle,
        // and is only true because nothing in this callback throws.
        const key = invitationAcceptThrottleKey(command.clientIp, command.accountId);
        const since = new Date(now.getTime() - AUTH_ATTEMPT_WINDOW_MS);
        if ((await tx.countRecentAuthAttempts(key, since)) >= AUTH_ATTEMPT_LIMIT) {
          return { kind: OUTCOME.RATE_LIMITED };
        }
        await tx.recordAuthAttempt(key, now);

        // The two checks are separate, and the compiler is what asked for it: with them combined
        // by `||`, `standing` stays the full union inside the branch and cannot be handed to a
        // refusal that only accepts the four unusable values. Splitting them narrows correctly and
        // reads better — a token naming no row is its own sentence, not a variant of "expired".
        const invitation = await tx.findInvitation();
        if (invitation === null) {
          return { kind: OUTCOME.NOT_ACCEPTABLE, standing: INVITATION_STANDING.UNKNOWN };
        }

        const standing = invitationStanding(invitation, now);
        if (standing !== INVITATION_STANDING.ACCEPTABLE) {
          // Carries the standing, because S-03 draws expired, already-used and revoked as three
          // distinguishable recoverable states and a screen cannot branch on wording.
          return { kind: OUTCOME.NOT_ACCEPTABLE, standing };
        }

        // FR-11's binding, and UC-15's business rule in one comparison: "the invitation binds to
        // the invited address, so a social sign-in is accepted only where the provider asserts that
        // same address". Nothing here special-cases providers — the account's own address is what
        // task 24 already established a provider assertion has to match, so an identity asserting
        // some other address cannot reach this check with a matching account in the first place.
        //
        // `emailIdentityKey` rather than a bare comparison, because it is what `account_email_key`
        // and 26.1's partial index both mean by equality: `Ana@x.md` and `ana@x.md` are one person.
        const acceptorEmail = await tx.findAccountEmail(command.accountId);
        if (
          acceptorEmail === null ||
          emailIdentityKey(acceptorEmail) !== emailIdentityKey(invitation.invitedEmail)
        ) {
          return { kind: OUTCOME.ADDRESS_MISMATCH };
        }

        // Conditional on the row still being `pending`, so FR-11's single-use is the database's
        // claim: two simultaneous clicks produce one `true` and one `false`, and the loser is told
        // the link is spent rather than being granted a second membership.
        if (!(await tx.consume({ invitationId: invitation.id, at: now }))) {
          return { kind: OUTCOME.NOT_ACCEPTABLE, standing: INVITATION_STANDING.CONSUMED };
        }

        const grant = await tx.grantMembership({
          accountId: command.accountId,
          organizationId: invitation.organizationId,
          role: invitation.role,
          at: now,
        });

        // §12.5.6's task-26.2 row. Written even when they were `already_member`, because the
        // outcome S-03 promises — landing in this organization — is what the person clicked for,
        // and it is true of that case too.
        await tx.setActiveOrganization({
          sessionId: command.sessionId,
          organizationId: invitation.organizationId,
        });

        return {
          kind: OUTCOME.ACCEPTED,
          accepted: {
            organizationId: invitation.organizationId,
            organizationName: invitation.organizationName,
            // From the grant, NOT from the invitation. For an existing member the two differ — the
            // invitation does not change their role — and answering with the invitation's would
            // tell an administrator they are an editor, on the screen they land on to use it.
            role: grant.role,
            grant: grant.kind,
          },
        };
      },
    );

    // Everything above has committed by now, throttle row included.
    if (outcome.kind === OUTCOME.RATE_LIMITED) throw new AuthRateLimitedError();
    if (outcome.kind === OUTCOME.NOT_ACCEPTABLE) {
      throw new InvitationNotAcceptableError(outcome.standing);
    }
    if (outcome.kind === OUTCOME.ADDRESS_MISMATCH) throw new InvitationNotYoursError();
    return outcome.accepted;
  }
}
