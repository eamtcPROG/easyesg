import { Controller, Get, HttpCode, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiListResponse, ApiObjectResponse } from '@api/app/decorators/api-envelope.decorator';
import { AUDIT_TARGET, AuditAction } from '@api/app/decorators/audit-action.decorator';
import { AUDIT_ACTION } from '@api/modules/platform/audit/models/audit-action.model';
import { RequiresAdminRole } from '../decorators/requires-admin-role.decorator';
import { DisclosedPhoneResponseDto } from '../dto/disclosed-phone.response.dto';
import { OrganizationMemberResponseDto } from '../dto/organization-member.response.dto';
import { ADMIN_ROLE } from '../models/admin-session.model';
import { OrganizationMembersService } from '../services/organization-members.service';

const PROBLEM = { 'application/problem+json': {} };
const ORGANIZATION_ID = 'organizationId';
const ACCOUNT_ID = 'accountId';

const SIGNED_OUT = {
  status: 401,
  description:
    'No usable operator session (problem type authentication-required), or its lifetimes ran out ' +
    '(problem type session-expired).',
  content: PROBLEM,
} as const;

const NOT_PLATFORM_ADMINISTRATOR = {
  status: 403,
  description: 'The operator’s role is not platform_administrator (problem type insufficient-role).',
  content: PROBLEM,
} as const;

/**
 * `/api/v1/admin/organizations/:organizationId/members` — A-02's record's people (task 167; UC-69, FR-9, FR-76;
 * §12.5.6's task-167 row): who an organization's accounts belong to, and — one person at a time — the phone a person
 * gave for support to reach them.
 *
 * **A Platform Administrator's**, like the register. **Read through `esg_admin_ro`, logged before it reads.** **A
 * disclosure is a POST carrying `@AuditAction`** because it is the one act here that must be accounted for person by
 * person: `AuditInterceptor` writes the system audit log's row once it answers, naming the account, and A-08's log
 * reads it with every other operator action. A GET cannot carry one — the route-permission gate refuses an audit
 * action on a read — and a read that records who read it is not a read that changes nothing.
 */
@ApiTags('platform')
@Controller(`admin/organizations/:${ORGANIZATION_ID}/members`)
@RequiresAdminRole(ADMIN_ROLE.PLATFORM_ADMINISTRATOR)
export class OrganizationMembersController {
  constructor(private readonly members: OrganizationMembersService) {}

  @Get()
  @ApiOperation({
    summary: 'The organization’s active members',
    description:
      'Task 167. Each person’s name, sign-in address and role, and whether they gave a phone number — never the ' +
      'number itself, and never report content. Recorded in the support access log before it runs.',
  })
  @ApiParam({ name: ORGANIZATION_ID, format: 'uuid' })
  @ApiListResponse(OrganizationMemberResponseDto, { status: 200, description: 'Every active member, by name.' })
  @ApiResponse(SIGNED_OUT)
  @ApiResponse(NOT_PLATFORM_ADMINISTRATOR)
  @ApiResponse({
    status: 404,
    description: 'No organization in the register holds this id (problem type not-found).',
    content: PROBLEM,
  })
  async list(
    @Param(ORGANIZATION_ID, ParseUUIDPipe) organizationId: string,
  ): Promise<OrganizationMemberResponseDto[]> {
    const members = await this.members.members({ organizationId });
    return members.map((member) => new OrganizationMemberResponseDto(member));
  }

  @Post(`:${ACCOUNT_ID}/phone-disclosure`)
  @HttpCode(200)
  @AuditAction({
    action: AUDIT_ACTION.ADMIN_MEMBER_PHONE_DISCLOSED,
    target: { from: AUDIT_TARGET.PARAM, name: ACCOUNT_ID },
  })
  @ApiOperation({
    summary: 'Show one member’s phone number',
    description:
      'Task 167. The number the person gave for support to reach them about their account. Each disclosure is ' +
      'recorded in the system audit log, naming the operator and the person, and in the support access log.',
  })
  @ApiParam({ name: ORGANIZATION_ID, format: 'uuid' })
  @ApiParam({ name: ACCOUNT_ID, format: 'uuid' })
  @ApiObjectResponse(DisclosedPhoneResponseDto, { status: 200, description: 'The number, in international form.' })
  @ApiResponse(SIGNED_OUT)
  @ApiResponse(NOT_PLATFORM_ADMINISTRATOR)
  @ApiResponse({
    status: 404,
    description:
      'The account is not an active member of this organization, or gave no phone number (problem type not-found).',
    content: PROBLEM,
  })
  async disclose(
    @Param(ORGANIZATION_ID, ParseUUIDPipe) organizationId: string,
    @Param(ACCOUNT_ID, ParseUUIDPipe) accountId: string,
  ): Promise<DisclosedPhoneResponseDto> {
    return new DisclosedPhoneResponseDto(await this.members.phone({ organizationId, accountId }));
  }
}
