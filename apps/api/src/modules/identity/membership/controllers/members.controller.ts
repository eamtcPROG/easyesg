import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiListResponse } from '@api/app/decorators/api-envelope.decorator';
import { NO_CONTENT_RESPONSE } from '@api/app/interceptors/global-response.interceptor';
import { ChangeMemberRoleRequestDto } from '../dto/change-member-role.request.dto';
import { MemberResponseDto } from '../dto/member.response.dto';
import { MEMBERSHIP_ROLE } from '../models/membership.model';
import { MembershipService } from '../services/membership.service';
import { RequiresRole } from '../decorators/requires-role.decorator';

/**
 * `/api/v1/members` — S-16's Users & access (UC-59, UC-62, UC-63, UC-64; FR-56, FR-58, FR-59,
 * FR-60).
 *
 * **The organization is not in the URL and must never be.** It comes from the session by way of
 * `AuthGuard`'s membership lookup, and an `{organizationId}` segment would be a second,
 * contradictory source of tenancy (AD-2, UX-2) — the kind a caller can edit. So the collection is
 * flatly `/members`, meaning "the active organization's". That also leaves `/memberships` free for
 * task 25.3, which answers the genuinely different question of which organizations the *caller*
 * belongs to.
 *
 * **Every route is Organization Administrator only**, declared once at the class. actors.md is
 * explicit for RC: *"explicitly no access to organization settings, the user list, or billing/plan
 * screens"* — the list is not a lesser privilege that an editor may hold, it is the same
 * administrative surface as the actions on it.
 *
 * **These are the first non-public routes in the API, and until task 28 they answer 401.**
 * `AuthGuard` is what resolves the actor, the organization and the role; with none resolved,
 * `RequiresRoleGuard` refuses. That is the fail-closed direction, and it is why the routes can ship
 * ahead of their resolver rather than waiting for it.
 *
 * A member is addressed by the membership's own id rather than by the account's: the membership is
 * the thing being changed, it is what the list already returns, and it keeps account identifiers
 * out of URLs.
 */
@ApiTags('identity')
@Controller('members')
@RequiresRole(MEMBERSHIP_ROLE.ORGANIZATION_ADMINISTRATOR)
export class MembersController {
  constructor(private readonly membershipService: MembershipService) {}

  @Get()
  @ApiOperation({
    summary: 'List everyone with access to the active organization',
    description:
      'Answers "who can see our ESG data": every active member with their role, status and last ' +
      'activity. Unpaginated by design — the collection is bounded by the plan’s seat ' +
      'entitlement. Pending invitations are a separate resource and do not appear here.',
  })
  @ApiListResponse(MemberResponseDto, { status: 200, description: 'The organization’s members.' })
  @ApiResponse({
    status: 403,
    description:
      'The caller holds no membership in an active organization (problem type ' +
      'membership-required), or holds one in a role that is not organization_administrator ' +
      '(problem type insufficient-role).',
    content: { 'application/problem+json': {} },
  })
  async list(): Promise<MemberResponseDto[]> {
    return (await this.membershipService.list()).map((member) => new MemberResponseDto(member));
  }

  @Patch(':membershipId')
  @HttpCode(204)
  @ApiOperation({
    summary: 'Change a member’s role, or promote them to Organization Administrator',
    description:
      'Takes effect on that member’s next request rather than at their next login, because the ' +
      'role is read from the membership record per request and is never carried in a token. ' +
      'Granting organization_administrator is how a second administrator is created, which is ' +
      'what makes demoting or removing the first one permissible.',
  })
  @ApiParam({ name: 'membershipId', format: 'uuid' })
  @ApiResponse({ status: 204, description: 'The role was changed.' })
  @ApiResponse({
    status: 404,
    description: 'No active member of this organization has that membership id.',
    content: { 'application/problem+json': {} },
  })
  @ApiResponse({
    status: 409,
    description:
      'The change would leave the organization with no Organization Administrator (problem type ' +
      'last-administrator). Promote another member first.',
    content: { 'application/problem+json': {} },
  })
  async changeRole(
    @Param('membershipId', ParseUUIDPipe) membershipId: string,
    @Body() body: ChangeMemberRoleRequestDto,
  ): Promise<typeof NO_CONTENT_RESPONSE> {
    await this.membershipService.changeRole({ membershipId, role: body.role });
    return NO_CONTENT_RESPONSE;
  }

  @Delete(':membershipId')
  @HttpCode(204)
  @ApiOperation({
    summary: 'Remove a member’s access to the organization',
    description:
      'Ends access without deleting the account or the member’s attributed history: their ' +
      'contributions remain attributed in the change history, and the membership record is ' +
      'retained showing when access was granted and withdrawn. Their sessions are not ended — ' +
      'the next request they make is simply refused, and they keep access to any other ' +
      'organization they belong to.',
  })
  @ApiParam({ name: 'membershipId', format: 'uuid' })
  @ApiResponse({ status: 204, description: 'Access was withdrawn.' })
  @ApiResponse({
    status: 404,
    description: 'No active member of this organization has that membership id.',
    content: { 'application/problem+json': {} },
  })
  @ApiResponse({
    status: 409,
    description:
      'Removing this member would leave the organization with no Organization Administrator ' +
      '(problem type last-administrator). Promote another member first.',
    content: { 'application/problem+json': {} },
  })
  async remove(
    @Param('membershipId', ParseUUIDPipe) membershipId: string,
  ): Promise<typeof NO_CONTENT_RESPONSE> {
    await this.membershipService.remove({ membershipId });
    return NO_CONTENT_RESPONSE;
  }
}
