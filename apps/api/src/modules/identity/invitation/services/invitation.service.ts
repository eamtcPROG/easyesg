import { Injectable } from '@nestjs/common';
import { SOURCE_LOCALE } from '@easyesg/i18n';
import { requestContext } from '@api/infrastructure/persistence/request-context';
import type { Invitation, PendingInvitation } from '../models/invitation.model';
import { IssueInvitation, type IssueInvitationCommand } from '../use-cases/issue-invitation.use-case';
import { ListInvitations } from '../use-cases/list-invitations.use-case';
import { ResendInvitation, type ResendInvitationCommand } from '../use-cases/resend-invitation.use-case';
import { RevokeInvitation, type RevokeInvitationCommand } from '../use-cases/revoke-invitation.use-case';
import { AcceptInvitation, type AcceptInvitationCommand, type AcceptedInvitation } from '../use-cases/accept-invitation.use-case';
import {
  PreviewInvitation,
  type InvitationPreview,
  type PreviewInvitationCommand,
} from '../use-cases/preview-invitation.use-case';
import { AuthenticationRequiredError } from '@api/modules/identity/membership/errors/membership.errors';

/**
 * A use case's command minus the fields THIS layer supplies from ambient request context — the
 * shape `AccountService` established, derived rather than hand-written so the two can never
 * disagree.
 *
 * `inviterLocale` is the one field: it is the locale negotiated from the inviting administrator's
 * `Accept-Language` (OQ-46), and a controller has no business passing it. Its name says which
 * party's preference it carries, which matters here in a way it does not on registration — this
 * request has two people in it, and the *invitee's* locale is what actually reaches the email
 * whenever they already have an account (§12.5.6, FR-169).
 */
type InvitationServiceInput<C> = Omit<C, 'inviterLocale'>;

/**
 * The Nest-aware seam between `InvitationsController` and the use cases (house rule, 20 Aug 2026:
 * controllers call services, services call use cases).
 *
 * Three of the four methods are single-use-case orchestrations, which is the honest minimum rather
 * than the pass-through `CLAUDE.md` warns against — the seam is the rule, and it is where task 26.4
 * or a later composition lands without the controller growing a second caller.
 *
 * `issue` is the one that earns the layer today, and it earns it the same way `AccountService`'s
 * `register` does: the negotiated locale is an application decision read from ambient context, not
 * a fact about HTTP, so a queued or scripted caller of this service gets the same behaviour with no
 * controller in sight.
 *
 * The commands are taken whole rather than destructured into parameters, so a field added to one
 * arrives here without touching this file (CLAUDE.md, "An application-boundary call takes one
 * object").
 */
@Injectable()
export class InvitationService {
  constructor(
    private readonly listInvitations: ListInvitations,
    private readonly issueInvitation: IssueInvitation,
    private readonly resendInvitation: ResendInvitation,
    private readonly revokeInvitation: RevokeInvitation,
    private readonly previewInvitation: PreviewInvitation,
    private readonly acceptInvitation: AcceptInvitation,
  ) {}

  list(): Promise<PendingInvitation[]> {
    return this.listInvitations.execute();
  }

  issue(input: InvitationServiceInput<IssueInvitationCommand>): Promise<Invitation> {
    return this.issueInvitation.execute({
      ...input,
      // Used only where the invited address has no account of its own — the fallback, not the
      // answer. `IssueInvitation` prefers the invitee's own stored locale, because FR-169 resolves
      // email language per recipient and this administrator is not the recipient.
      inviterLocale: requestContext()?.locale ?? SOURCE_LOCALE,
    });
  }

  resend(command: ResendInvitationCommand): Promise<void> {
    return this.resendInvitation.execute(command);
  }

  revoke(command: RevokeInvitationCommand): Promise<void> {
    return this.revokeInvitation.execute(command);
  }

  preview(input: PreviewInvitationServiceInput): Promise<InvitationPreview> {
    return this.previewInvitation.execute({ ...input, clientIp: requestContext()?.clientIp });
  }

  /**
   * Resolves the acceptor and their session from ambient request context, which is the reason this
   * layer exists (task 26.2).
   *
   * **Neither may ever arrive from the caller**, and that is not a style point: an `accountId` in a
   * request body would let anyone holding a link make *somebody else* a member of an organization,
   * and a `sessionId` would let them move a stranger's active tenant. `RequiresAccountGuard` has
   * already refused a request with no actor; this throws rather than trusting that, for
   * `listOwn`'s reason — the guard is a declaration, and this is the layer that would otherwise
   * write a membership for `undefined`.
   */
  accept(input: AcceptInvitationServiceInput): Promise<AcceptedInvitation> {
    const context = requestContext();
    if (!context?.actorId || !context.sessionId) throw new AuthenticationRequiredError();

    return this.acceptInvitation.execute({
      ...input,
      accountId: context.actorId,
      sessionId: context.sessionId,
      clientIp: context.clientIp,
    });
  }
}

/**
 * Each command minus what this layer supplies from ambient context — `AccountService`'s shape,
 * derived so a field added to either arrives here without touching this file.
 *
 * `clientIp` is in both omissions for the reason `AccountServiceInput` states: it comes from the
 * socket, and a caller supplying it would be choosing which throttle bucket to spend.
 */
type PreviewInvitationServiceInput = Omit<PreviewInvitationCommand, 'clientIp'>;

type AcceptInvitationServiceInput = Omit<
  AcceptInvitationCommand,
  'accountId' | 'sessionId' | 'clientIp'
>;
