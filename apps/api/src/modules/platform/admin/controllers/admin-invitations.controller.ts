import { Body, Controller, Delete, HttpCode, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiObjectResponse } from '@api/app/decorators/api-envelope.decorator';
import { AUDIT_TARGET, AuditAction } from '@api/app/decorators/audit-action.decorator';
import { NO_CONTENT_RESPONSE } from '@api/app/interceptors/global-response.interceptor';
import { AUDIT_ACTION } from '@api/modules/platform/audit/models/audit-action.model';
import { RequiresAdminRole } from '../decorators/requires-admin-role.decorator';
import { AdminInvitationResponseDto } from '../dto/admin-invitation.response.dto';
import { InviteAdministratorRequestDto } from '../dto/invite-administrator.request.dto';
import { ADMIN_ROLE } from '../models/admin-session.model';
import { AdminInvitationsService } from '../services/admin-invitations.service';

const PROBLEM = { 'application/problem+json': {} };
const INVITATION_ID = 'invitationId';
const BY_INVITATION = { from: AUDIT_TARGET.PARAM, name: INVITATION_ID } as const;

const SIGNED_OUT = {
  status: 401,
  description:
    'No usable operator session (problem type authentication-required), or its lifetimes ran out ' +
    '(problem type session-expired).',
  content: PROBLEM,
} as const;

const NOT_PLATFORM_ADMINISTRATOR = {
  status: 403,
  description:
    'The operator’s role is not platform_administrator (problem type insufficient-role), or the ' +
    'request came from an origin other than the console’s.',
  content: PROBLEM,
} as const;

const NO_PENDING_INVITATION = {
  status: 404,
  description: 'No pending invitation has this id — accepted, revoked, or never sent (problem type not-found).',
  content: PROBLEM,
} as const;

const MAIL_WINDOW_SPENT = {
  status: 429,
  description:
    'Five invitation emails have gone to this address in the last fifteen minutes (problem type ' +
    'rate-limited).',
  content: PROBLEM,
} as const;

const INVITATION_PARAM = { name: INVITATION_ID, format: 'uuid', description: 'The invitation.' } as const;

/**
 * `/api/v1/admin/invitations` — how an operator account comes into existence from the console (task
 * 67.4; UC-87; §12.5.6's task-67.4 row). A single-use link valid for 24 hours goes to the address, and
 * the invitee sets their own password and second factor on A-20, so no credential passes through the
 * inviting operator. Every write declares its audit action.
 */
@ApiTags('platform')
@Controller('admin/invitations')
@RequiresAdminRole(ADMIN_ROLE.PLATFORM_ADMINISTRATOR)
export class AdminInvitationsController {
  constructor(private readonly invitations: AdminInvitationsService) {}

  @Post()
  @HttpCode(201)
  @AuditAction({ action: AUDIT_ACTION.ADMIN_INVITATION_ISSUED, target: { from: AUDIT_TARGET.RESULT } })
  @ApiOperation({
    summary: 'Invite an operator into either realm',
    description:
      'UC-87. Emails a single-use link, valid for 24 hours, to the address; the account exists only ' +
      'once the invitee sets a password and confirms a second factor. Recorded in the system audit log.',
  })
  @ApiObjectResponse(AdminInvitationResponseDto, { status: 201, description: 'The invitation was sent.' })
  @ApiResponse(SIGNED_OUT)
  @ApiResponse(NOT_PLATFORM_ADMINISTRATOR)
  @ApiResponse({
    status: 409,
    description:
      'An account that is not removed holds the address (problem type admin-account-exists), or the ' +
      'address already has a pending invitation (problem type invitation-outstanding).',
    content: PROBLEM,
  })
  @ApiResponse(MAIL_WINDOW_SPENT)
  async invite(@Body() body: InviteAdministratorRequestDto): Promise<AdminInvitationResponseDto> {
    return new AdminInvitationResponseDto(await this.invitations.invite(body));
  }

  @Post(`:${INVITATION_ID}/email`)
  @HttpCode(204)
  @AuditAction({ action: AUDIT_ACTION.ADMIN_INVITATION_RESENT, target: BY_INVITATION })
  @ApiOperation({
    summary: 'Send an invitation again, with a new link',
    description:
      'The previous link stops working at once and the 24 hours restart. A lapsed invitation is ' +
      'resent this way. Recorded in the system audit log.',
  })
  @ApiParam(INVITATION_PARAM)
  @ApiResponse({ status: 204, description: 'Sent again.' })
  @ApiResponse(SIGNED_OUT)
  @ApiResponse(NOT_PLATFORM_ADMINISTRATOR)
  @ApiResponse(NO_PENDING_INVITATION)
  @ApiResponse(MAIL_WINDOW_SPENT)
  async resend(
    @Param(INVITATION_ID, ParseUUIDPipe) invitationId: string,
  ): Promise<typeof NO_CONTENT_RESPONSE> {
    await this.invitations.resend({ invitationId });
    return NO_CONTENT_RESPONSE;
  }

  @Delete(`:${INVITATION_ID}`)
  @HttpCode(204)
  @AuditAction({ action: AUDIT_ACTION.ADMIN_INVITATION_REVOKED, target: BY_INVITATION })
  @ApiOperation({
    summary: 'Revoke a pending invitation',
    description:
      'The link stops working at once and the address may be invited again. Recorded in the system ' +
      'audit log.',
  })
  @ApiParam(INVITATION_PARAM)
  @ApiResponse({ status: 204, description: 'Revoked.' })
  @ApiResponse(SIGNED_OUT)
  @ApiResponse(NOT_PLATFORM_ADMINISTRATOR)
  @ApiResponse(NO_PENDING_INVITATION)
  async revoke(
    @Param(INVITATION_ID, ParseUUIDPipe) invitationId: string,
  ): Promise<typeof NO_CONTENT_RESPONSE> {
    await this.invitations.revoke({ invitationId });
    return NO_CONTENT_RESPONSE;
  }
}
