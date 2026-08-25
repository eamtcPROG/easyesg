import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '@api/app/decorators/public.decorator';
import { ApiObjectResponse } from '@api/app/decorators/api-envelope.decorator';
import { RequiresAccount } from '@api/modules/identity/membership/decorators/requires-account.decorator';
import { AcceptedInvitationResponseDto } from '../dto/accepted-invitation.response.dto';
import { InvitationPreviewResponseDto } from '../dto/invitation-preview.response.dto';
import { InvitationTokenRequestDto } from '../dto/invitation-token.request.dto';
import { InvitationService } from '../services/invitation.service';

/**
 * `/api/v1/invitations/{preview,acceptance}` — S-03's API half (UC-15, FR-11; task 26.2).
 *
 * **A second controller on the same path prefix, and the split is the gate.** `InvitationsController`
 * is `@RequiresRole(organization_administrator)` at the class, which is right for the administrator
 * managing invitations and exactly wrong for the person receiving one — the invitee is, by
 * definition, not yet a member of anything. Putting these two routes there would have meant peeling
 * the class-level gate off and re-applying it per method, which is the shape `@RequiresRole` was
 * built to prevent: a route that carries no gate reads identical to one that does.
 *
 * So the resource is the same and the guards differ per controller, which is the honest expression
 * of what is true — `/invitations` is the administrator's collection, and these two are what its
 * recipients may do with one link.
 *
 * **`preview` is `@Public()` and `acceptance` is `@RequiresAccount()`**, which is the whole flow in
 * two decorators. UC-15 step 2 has the invitee choosing whether to create an account, and nobody
 * chooses that without being told who is asking — so the preview must answer a signed-out caller.
 * Acceptance needs an actor to make a member of, and `@RequiresAccount` is the one gate that admits
 * someone who belongs to no organization yet, which every acceptor does by definition (25.3 built
 * it for `/memberships` and this is its second consumer).
 *
 * **No entitlement gate, recorded rather than omitted.** Seat entitlement is checked where the
 * invitation is issued (UC-60), not where it is accepted — refusing at acceptance would punish the
 * invitee for the inviter's plan. `EntitlementPort` has no implementation until task 54 either way.
 */
@ApiTags('identity')
@Controller('invitations')
export class InvitationAcceptanceController {
  constructor(private readonly invitationService: InvitationService) {}

  /**
   * **`200`, not Nest's POST default of `201`.** This creates nothing — the whole design point is
   * that the link is spent by an explicit acceptance and never by being read — and a published
   * contract saying Created is one a generated client will treat as a creation, with the retry,
   * caching and monitoring semantics that follow. The body is a POST only to keep the token out of
   * the URL, which is a transport choice rather than a creation.
   */
  @Post('preview')
  @HttpCode(200)
  @Public()
  @ApiOperation({
    summary: 'Read an invitation without using it',
    description:
      'What the invitation offers, so the recipient can decide whether to create an account. ' +
      'Consumes nothing: the link is spent by an explicit acceptance, never by being opened, so a ' +
      'mail scanner following it cannot burn someone’s invitation. A link that is spent, withdrawn ' +
      'or out of date answers why and withholds the rest.',
  })
  @ApiObjectResponse(InvitationPreviewResponseDto, {
    status: 200,
    description: 'The invitation’s standing, with its details where it is still usable.',
  })
  async preview(
    @Body() body: InvitationTokenRequestDto,
  ): Promise<InvitationPreviewResponseDto> {
    return new InvitationPreviewResponseDto(await this.invitationService.preview(body));
  }

  @Post('acceptance')
  @RequiresAccount()
  @ApiOperation({
    summary: 'Join the organization the invitation names',
    description:
      'Grants the invited role in that organization and makes it the active one for this session, ' +
      'so the next request is already scoped to it. The invitation is single-use and is spent ' +
      'here. Someone who already has access keeps the role they hold — accepting never changes an ' +
      'existing role — and someone whose access was withdrawn earlier has it restored.',
  })
  @ApiObjectResponse(AcceptedInvitationResponseDto, {
    status: 201,
    description: 'The organization joined, the role now held, and which of the three happened.',
  })
  @ApiResponse({
    status: 403,
    description:
      'The request carries no session (problem type authentication-required), or is signed in as ' +
      'an account the invitation does not name (problem type invitation-address-mismatch). An ' +
      'invitation binds to one address, which is what stops a sign-in for a different one using it.',
    content: { 'application/problem+json': {} },
  })
  @ApiResponse({
    status: 410,
    description:
      'The link cannot be used (problem type invitation-not-acceptable). The document carries a ' +
      'standing member saying which: expired, consumed, revoked, or unknown. None is retryable — ' +
      'ask an administrator for a new invitation.',
    content: { 'application/problem+json': {} },
  })
  async accept(
    @Body() body: InvitationTokenRequestDto,
  ): Promise<AcceptedInvitationResponseDto> {
    return new AcceptedInvitationResponseDto(await this.invitationService.accept(body));
  }
}
