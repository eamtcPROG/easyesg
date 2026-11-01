import { Inject, Injectable } from '@nestjs/common';
import { PUSH_EVENT, PUSH_HINTS, type PushHints } from '@api/contracts/push.port';

import { requestContext, requestLocale } from '@api/infrastructure/persistence/request-context';
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
 * `inviterLocale` is the locale negotiated from the inviting administrator's `Accept-Language`
 * (OQ-46), and a controller has no business passing it. Its name says which party's preference it
 * carries, which matters here in a way it does not on registration — this request has two people in
 * it, and the *invitee's* locale is what actually reaches the email whenever they already have an
 * account (§12.5.6, FR-169).
 *
 * **`organizationId` joined it at task 141** — on **both** commands, since the two mail routes share
 * one window — and it is omitted for a stronger reason than tidiness: a caller who could supply it
 * would be choosing which throttle bucket to spend, which is the same objection
 * `AcceptInvitationServiceInput` records about `clientIp` one layer down. It is read from
 * `AuthGuard`'s membership lookup, which is AD-2's own source — and it reaches the *key* only, never
 * a store method, per `InvitationStore`'s header.
 */
type InvitationServiceInput<C> = Omit<C, 'inviterLocale' | 'organizationId'>;

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
    @Inject(PUSH_HINTS) private readonly hints: PushHints,
  ) {}

  /**
   * S-16's list changed (task 148; §12.5.6's task-148 row (2)) — hinted on the request's own transaction after the
   * use case succeeded, so a refusal hints nothing and the hint commits with the change.
   */
  private accessChanged(organizationId: string): Promise<void> {
    return this.hints.hint({ event: PUSH_EVENT.ACCESS_CHANGED, organizationId });
  }

  list(): Promise<PendingInvitation[]> {
    return this.listInvitations.execute();
  }

  /**
   * The tenant both mail routes key their amplification window on (task 141).
   *
   * `@RequiresRole(OA)` has already refused a request with no bound organization, and this throws
   * rather than trusting that — `accept` states the reasoning: a guard is a declaration, and this is
   * the layer that would otherwise build a throttle key reading `undefined` and pool every
   * organization's invitations into one bucket, which is the cross-tenant interference the key's
   * shape exists to prevent.
   */
  private boundOrganization(): string {
    const organizationId = requestContext()?.organizationId;
    if (!organizationId) throw new AuthenticationRequiredError();
    return organizationId;
  }

  async issue(input: InvitationServiceInput<IssueInvitationCommand>): Promise<Invitation> {
    const organizationId = this.boundOrganization();
    const invitation = await this.issueInvitation.execute({
      ...input,
      organizationId,
      // Used only where the invited address has no account of its own — the fallback, not the
      // answer. `IssueInvitation` prefers the invitee's own stored locale, because FR-169 resolves
      // email language per recipient and this administrator is not the recipient.
      inviterLocale: requestLocale(),
    });
    await this.accessChanged(organizationId);
    return invitation;
  }

  async resend(input: InvitationServiceInput<ResendInvitationCommand>): Promise<void> {
    const organizationId = this.boundOrganization();
    await this.resendInvitation.execute({ ...input, organizationId });
    await this.accessChanged(organizationId);
  }

  async revoke(command: RevokeInvitationCommand): Promise<void> {
    await this.revokeInvitation.execute(command);
    await this.accessChanged(this.boundOrganization());
  }

  preview(command: PreviewInvitationCommand): Promise<InvitationPreview> {
    return this.previewInvitation.execute(command);
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
  async accept(input: AcceptInvitationServiceInput): Promise<AcceptedInvitation> {
    const context = requestContext();
    if (!context?.actorId || !context.sessionId) throw new AuthenticationRequiredError();

    const accepted = await this.acceptInvitation.execute({
      ...input,
      accountId: context.actorId,
      sessionId: context.sessionId,
      clientIp: context.clientIp,
    });
    // The inviting organization's list — the acceptance's own transaction has committed; this row commits with the
    // request, so the worker publishes it after both (the owner's driver: S-16 gains the row someone just accepted).
    await this.accessChanged(accepted.organizationId);
    return accepted;
  }
}

/**
 * The accept command minus what this layer supplies from ambient context — `AccountService`'s
 * shape, derived so a field added to it arrives here without touching this file.
 *
 * `clientIp` is omitted for the reason `AccountServiceInput` states: it comes from the socket, and
 * a caller supplying it would be choosing which throttle bucket to spend. The preview has no such
 * omission because it has no throttle — §12.5.6's task-26.3 row records why.
 */
type AcceptInvitationServiceInput = Omit<
  AcceptInvitationCommand,
  'accountId' | 'sessionId' | 'clientIp'
>;
