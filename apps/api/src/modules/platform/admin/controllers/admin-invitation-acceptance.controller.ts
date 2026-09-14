import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiObjectResponse } from '@api/app/decorators/api-envelope.decorator';
import { Public } from '@api/app/decorators/public.decorator';
import { AcceptAdminInvitationRequestDto } from '../dto/accept-admin-invitation.request.dto';
import { AcceptedAdminInvitationResponseDto } from '../dto/accepted-admin-invitation.response.dto';
import { AdminEnrolmentResponseDto } from '../dto/admin-enrolment.response.dto';
import { AdminInvitationPreviewResponseDto } from '../dto/admin-invitation-preview.response.dto';
import { AdminInvitationTokenRequestDto } from '../dto/admin-invitation-token.request.dto';
import { AdminOriginGuard } from '../guards/admin-origin.guard';
import { AdminInvitationAcceptanceService } from '../services/admin-invitation-acceptance.service';

const PROBLEM = { 'application/problem+json': {} };

const LINK_NOT_ACCEPTABLE = {
  status: 410,
  description:
    'The link cannot become an account: it expired, was revoked, was already used, or does not ' +
    'resolve — including a link a resend replaced (problem type invitation-not-acceptable; the ' +
    '`standing` extension says which).',
  content: PROBLEM,
} as const;

const BEARER_WINDOW_SPENT = {
  status: 429,
  description:
    'Five links from this address that did not resolve in the last fifteen minutes (problem type ' +
    'rate-limited). A live link spends nothing.',
  content: PROBLEM,
} as const;

/**
 * `/api/v1/auth/admin/invitation/*` — A-20, where an administrator invitation becomes an account (task
 * 67.4; UC-87; §12.5.6's task-67.4 row).
 *
 * **Beside the handshake rather than under `/admin`**, because the bearer holds no operator session
 * and cannot — the token is the capability. `@Public()` to the tenant guard, like the handshake, and
 * no `@RequiresAdminRole`, since there is no operator to judge; **the Origin proof applies**, as it
 * does to the handshake's writes, because these are the realm's writes too.
 *
 * **Every route takes the token in a body**, never a path or a query: a value that sets a credential
 * does not belong in an access log. Not audited by `AuditInterceptor` — the acceptance is written by
 * its use case, with the account it created as the actor.
 */
@ApiTags('platform')
@UseGuards(AdminOriginGuard)
@Controller('auth/admin/invitation')
@Public()
export class AdminInvitationAcceptanceController {
  constructor(private readonly acceptance: AdminInvitationAcceptanceService) {}

  @Post('preview')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Read what an administrator invitation link invites',
    description: 'A-20’s first read: the address and the realm, so the invitee knows what they are joining.',
  })
  @ApiObjectResponse(AdminInvitationPreviewResponseDto, { status: 200, description: 'The link is live.' })
  @ApiResponse(LINK_NOT_ACCEPTABLE)
  @ApiResponse(BEARER_WINDOW_SPENT)
  async preview(@Body() body: AdminInvitationTokenRequestDto): Promise<AdminInvitationPreviewResponseDto> {
    return new AdminInvitationPreviewResponseDto(await this.acceptance.preview(body));
  }

  @Post('enrolment')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Stage the second factor the account will be created with',
    description:
      'Answers the secret and its Key Uri. Asked again, it answers the same secret, so a reload does ' +
      'not invalidate a scan; only a resend replaces it.',
  })
  @ApiObjectResponse(AdminEnrolmentResponseDto, { status: 200, description: 'The factor is staged.' })
  @ApiResponse(LINK_NOT_ACCEPTABLE)
  @ApiResponse(BEARER_WINDOW_SPENT)
  async enrol(@Body() body: AdminInvitationTokenRequestDto): Promise<AdminEnrolmentResponseDto> {
    return new AdminEnrolmentResponseDto(await this.acceptance.stage(body));
  }

  @Post('acceptance')
  @HttpCode(201)
  @ApiOperation({
    summary: 'Accept the invitation — set the password and confirm the second factor',
    description:
      'Creates the operator account, holding the password and the confirmed factor, and spends the ' +
      'link. Issues no session: the new operator signs in to the console.',
  })
  @ApiObjectResponse(AcceptedAdminInvitationResponseDto, {
    status: 201,
    description: 'The account exists.',
  })
  @ApiResponse({
    status: 400,
    description: 'The password does not meet the policy (problem type validation-failed).',
    content: PROBLEM,
  })
  @ApiResponse({
    status: 401,
    description: 'The code is not current for the staged secret (problem type factor-invalid).',
    content: PROBLEM,
  })
  @ApiResponse({
    status: 409,
    description:
      'No factor was staged (problem type conflict), or an account that is not removed already holds ' +
      'the address (problem type admin-account-exists).',
    content: PROBLEM,
  })
  @ApiResponse(LINK_NOT_ACCEPTABLE)
  @ApiResponse(BEARER_WINDOW_SPENT)
  async accept(@Body() body: AcceptAdminInvitationRequestDto): Promise<AcceptedAdminInvitationResponseDto> {
    return new AcceptedAdminInvitationResponseDto(await this.acceptance.accept(body));
  }
}
