import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiListResponse, ApiObjectResponse } from '@api/app/decorators/api-envelope.decorator';
import { NO_CONTENT_RESPONSE } from '@api/app/interceptors/global-response.interceptor';
import { RequiresRole } from '@api/modules/identity/membership/decorators/requires-role.decorator';
import { MEMBERSHIP_ROLE } from '@api/modules/identity/membership/models/membership.model';
import { InvitationResponseDto } from '../dto/invitation.response.dto';
import { IssueInvitationRequestDto } from '../dto/issue-invitation.request.dto';
import { InvitationService } from '../services/invitation.service';

/**
 * `/api/v1/invitations` — S-16's invitation half (UC-60, UC-61; FR-11, FR-57).
 *
 * **The organization is not in the URL and must never be.** It comes from the session by way of
 * `AuthGuard`'s membership lookup, and an `{organizationId}` segment would be a second,
 * contradictory source of tenancy (AD-2, UX-2) — the kind a caller can edit. So the collection is
 * flatly `/invitations`, meaning "the active organization's", exactly as `/members` is.
 *
 * **Every route is Organization Administrator only**, declared once at the class. actors.md is
 * explicit for RC: *"explicitly no access to organization settings, the user list, or billing/plan
 * screens"* — and who else may be given access to the organization's data is the most
 * administrative question on that surface.
 *
 * **The resend is `POST .../email`, not `POST .../resend`.** It creates a delivery of an existing
 * invitation, which is the shape `/auth/verification-email` and `/auth/password-reset-email`
 * already use for the other two token kinds — and it is honest about what the request does: the
 * invitation is not re-sent unchanged, its link is reissued (§12.5.6's task-26.1 row).
 *
 * **Revocation is `DELETE`, and the row is not deleted.** The same reading `DELETE /members/{id}`
 * takes: the method names what the caller is removing — access, an outstanding link — and the
 * persistence answer is a status change, because FR-55 needs the record and no runtime role holds
 * `DELETE` on the table.
 *
 * **No entitlement gate, recorded rather than omitted** (`apps/api/CLAUDE.md`). UC-60's precondition
 * is available seat entitlement and UX-50 draws the quota path, but `EntitlementPort` has no
 * implementation until task 54 and `EntitlementGuard` does not exist — so an invitation beyond the
 * plan's allowance is issued. Closing it is one `@RequiresEntitlement('org.seats.max')` on `issue`.
 */
@ApiTags('identity')
@Controller('invitations')
@RequiresRole(MEMBERSHIP_ROLE.ORGANIZATION_ADMINISTRATOR)
export class InvitationsController {
  constructor(private readonly invitationService: InvitationService) {}

  @Get()
  @ApiOperation({
    summary: 'List the active organization’s outstanding invitations',
    description:
      'The other half of "who can see our ESG data": people invited but not yet joined. ' +
      'Unpaginated by design — the collection is bounded by the plan’s seat entitlement. An ' +
      'invitation whose link has lapsed still appears, because it is what holds the invited ' +
      'address; resending it restores a working link.',
  })
  @ApiListResponse(InvitationResponseDto, {
    status: 200,
    description: 'The outstanding invitations.',
  })
  @ApiResponse({
    status: 403,
    description:
      'The caller holds no membership in an active organization (problem type ' +
      'membership-required), or holds one in a role that is not organization_administrator ' +
      '(problem type insufficient-role).',
    content: { 'application/problem+json': {} },
  })
  async list(): Promise<InvitationResponseDto[]> {
    return (await this.invitationService.list()).map(
      (invitation) => new InvitationResponseDto(invitation),
    );
  }

  @Post()
  @HttpCode(201)
  @ApiOperation({
    summary: 'Invite someone to the organization with an edit or view-only role',
    description:
      'Issues a single-use invitation bound to the address and emails it. The link lasts seven ' +
      'days and can be reissued or withdrawn at any time before it is accepted.',
  })
  @ApiObjectResponse(InvitationResponseDto, {
    status: 201,
    description: 'The invitation was issued and its email was queued.',
  })
  @ApiResponse({
    status: 400,
    description: 'The address is malformed, or the role is not one that can be invited.',
    content: { 'application/problem+json': {} },
  })
  @ApiResponse({
    status: 409,
    description:
      'The address already belongs to a member of this organization (problem type already-member), ' +
      'or an invitation to it is already outstanding (problem type invitation-outstanding) — ' +
      'resend or revoke that one instead. Two problem types rather than one, because the two have ' +
      'different resolutions and a client should not have to read the wording to tell them apart.',
    content: { 'application/problem+json': {} },
  })
  async issue(@Body() body: IssueInvitationRequestDto): Promise<InvitationResponseDto> {
    return new InvitationResponseDto(await this.invitationService.issue(body));
  }

  @Post(':invitationId/email')
  @HttpCode(204)
  @ApiOperation({
    summary: 'Send the invitation again',
    description:
      'Reissues the link and restarts the seven days on the same invitation, so the person keeps ' +
      'their place in the list and their assigned role. The previously sent link stops working ' +
      'immediately — there is never more than one live link per invitation. An invitation whose ' +
      'link has already lapsed can be resent, which is what makes a forgotten one recoverable.',
  })
  @ApiParam({ name: 'invitationId', format: 'uuid' })
  @ApiResponse({ status: 204, description: 'A fresh link was issued and its email was queued.' })
  @ApiResponse({
    status: 404,
    description:
      'No outstanding invitation of this organization has that id — it was accepted or revoked.',
    content: { 'application/problem+json': {} },
  })
  async resend(
    @Param('invitationId', ParseUUIDPipe) invitationId: string,
  ): Promise<typeof NO_CONTENT_RESPONSE> {
    await this.invitationService.resend({ invitationId });
    return NO_CONTENT_RESPONSE;
  }

  @Delete(':invitationId')
  @HttpCode(204)
  @ApiOperation({
    summary: 'Withdraw an outstanding invitation',
    description:
      'The link stops working immediately, and the invited address is free to be invited again — ' +
      'at a different role, which is the usual reason. The record of the invitation is kept, so ' +
      'the history of who was offered access to the organization stays complete.',
  })
  @ApiParam({ name: 'invitationId', format: 'uuid' })
  @ApiResponse({ status: 204, description: 'The invitation was withdrawn.' })
  @ApiResponse({
    status: 404,
    description:
      'No outstanding invitation of this organization has that id. An invitation that has already ' +
      'been accepted is a membership; end that person’s access from the members collection.',
    content: { 'application/problem+json': {} },
  })
  async revoke(
    @Param('invitationId', ParseUUIDPipe) invitationId: string,
  ): Promise<typeof NO_CONTENT_RESPONSE> {
    await this.invitationService.revoke({ invitationId });
    return NO_CONTENT_RESPONSE;
  }
}
