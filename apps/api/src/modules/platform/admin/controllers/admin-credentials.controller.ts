import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiObjectResponse } from '@api/app/decorators/api-envelope.decorator';
import { AUDIT_TARGET, AuditAction } from '@api/app/decorators/audit-action.decorator';
import { NO_CONTENT_RESPONSE } from '@api/app/interceptors/global-response.interceptor';
import { AUDIT_ACTION } from '@api/modules/platform/audit/models/audit-action.model';
import { RequiresAdminRole } from '../decorators/requires-admin-role.decorator';
import { AdminCredentialsResponseDto } from '../dto/admin-credentials.response.dto';
import { AdminEnrolmentResponseDto } from '../dto/admin-enrolment.response.dto';
import { AdminPasswordChangedResponseDto } from '../dto/admin-password-changed.response.dto';
import { AdminReauthenticationRequestDto } from '../dto/admin-reauthentication.request.dto';
import { AdminRecoveryCodesResponseDto } from '../dto/admin-recovery-codes.response.dto';
import { ChangeAdminPasswordRequestDto } from '../dto/change-admin-password.request.dto';
import { ConfirmAdminReenrolmentRequestDto } from '../dto/confirm-admin-reenrolment.request.dto';
import { ADMIN_ROLE } from '../models/admin-session.model';
import { AdminCredentialsService } from '../services/admin-credentials.service';

const PROBLEM = { 'application/problem+json': {} };

/** Every write names the operator's own account — the session's, which no route parameter carries. */
const OWN_ACCOUNT = { from: AUDIT_TARGET.OPERATOR } as const;

const SIGNED_OUT = {
  status: 401,
  description:
    'No usable operator session (problem type authentication-required), or its lifetimes ran out ' +
    '(problem type session-expired).',
  content: PROBLEM,
} as const;

const PASSWORD_REFUSED = {
  status: 403,
  description:
    'The current password is not right (problem type credential-invalid), or the request came from an ' +
    'origin other than the console’s.',
  content: PROBLEM,
} as const;

const THROTTLED = {
  status: 429,
  description:
    'Too many attempts at the current password in the window (problem type rate-limited) — every write ' +
    'on this screen spends the same one.',
  content: PROBLEM,
} as const;

/**
 * `/api/v1/admin/credentials` — A-19, the operator's own password, second factor and recovery codes
 * (task 144; UC-212, FR-80; `architecture.md` §12.5.6's task-144 row).
 *
 * **Both roles**, because every operator holds a password and a mandatory second factor, and A-08
 * deliberately has no second-factor reset. **Every write asks for the current password** — the confirmation
 * of a re-enrolment included — and **declares its audit action**, naming the operator's own account. Action
 * nouns under the credential, the tenant `/account/totp/{enrolment,confirmation}` shape, so each step keeps
 * its own refusals in the contract.
 */
@ApiTags('platform')
@Controller('admin/credentials')
@RequiresAdminRole(ADMIN_ROLE.PLATFORM_ADMINISTRATOR, ADMIN_ROLE.BILLING_OPERATOR)
export class AdminCredentialsController {
  constructor(private readonly credentials: AdminCredentialsService) {}

  @Get()
  @ApiOperation({
    summary: 'Read the operator’s own credential state',
    description:
      'UC-212. When the current set of recovery codes was issued and how many remain — never a code and ' +
      'never a secret. The password and the second factor are always in force on an operator account.',
  })
  @ApiObjectResponse(AdminCredentialsResponseDto, {
    status: 200,
    description: 'The operator’s credential state.',
  })
  @ApiResponse(SIGNED_OUT)
  async state(): Promise<AdminCredentialsResponseDto> {
    return new AdminCredentialsResponseDto(await this.credentials.state());
  }

  @Post('password')
  @HttpCode(200)
  @AuditAction({ action: AUDIT_ACTION.ADMIN_PASSWORD_CHANGED, target: OWN_ACCOUNT })
  @ApiOperation({
    summary: 'Change the operator’s own password',
    description:
      'UC-212 step one. Requires the current password, and optionally ends the operator’s other sessions — ' +
      'never the one making the request. Releases no lock. Recorded in the system audit log.',
  })
  @ApiObjectResponse(AdminPasswordChangedResponseDto, {
    status: 200,
    description: 'Changed; the body says how many other sessions ended.',
  })
  @ApiResponse({
    status: 400,
    description: 'The new password does not meet the policy (problem type validation-failed).',
    content: PROBLEM,
  })
  @ApiResponse(SIGNED_OUT)
  @ApiResponse(PASSWORD_REFUSED)
  @ApiResponse(THROTTLED)
  async changePassword(
    @Body() body: ChangeAdminPasswordRequestDto,
  ): Promise<AdminPasswordChangedResponseDto> {
    return new AdminPasswordChangedResponseDto(await this.credentials.changePassword(body));
  }

  @Post('totp/enrolment')
  @HttpCode(201)
  @AuditAction({ action: AUDIT_ACTION.ADMIN_FACTOR_REENROLMENT_STARTED, target: OWN_ACCOUNT })
  @ApiOperation({
    summary: 'Stage a new second factor beside the one in force',
    description:
      'UC-212 step two, first half. Requires the current password, and answers a new secret and its ' +
      'otpauth URI — once. The factor in force keeps signing the operator in until a confirmation; asked ' +
      'again, this replaces the staged secret with a new one. Recorded in the system audit log.',
  })
  @ApiObjectResponse(AdminEnrolmentResponseDto, {
    status: 201,
    description: 'Staged: scan or type the secret, then confirm it with a current code.',
  })
  @ApiResponse(SIGNED_OUT)
  @ApiResponse(PASSWORD_REFUSED)
  @ApiResponse(THROTTLED)
  async beginReenrolment(
    @Body() body: AdminReauthenticationRequestDto,
  ): Promise<AdminEnrolmentResponseDto> {
    return new AdminEnrolmentResponseDto(await this.credentials.beginReenrolment(body));
  }

  @Post('totp/confirmation')
  @HttpCode(204)
  @AuditAction({ action: AUDIT_ACTION.ADMIN_FACTOR_REENROLLED, target: OWN_ACCOUNT })
  @ApiOperation({
    summary: 'Confirm the staged second factor and put it in force',
    description:
      'UC-212 step two, second half. Requires the current password and a current code from the new ' +
      'authenticator; the staged secret then replaces the factor in force. Recovery codes and sessions ' +
      'are untouched. Recorded in the system audit log.',
  })
  @ApiResponse({ status: 204, description: 'The new second factor is in force.' })
  @ApiResponse(SIGNED_OUT)
  @ApiResponse({
    status: 403,
    description:
      'The current password is not right (problem type credential-invalid), the code is not current for ' +
      'the new authenticator (problem type factor-invalid), or the request came from another origin.',
    content: PROBLEM,
  })
  @ApiResponse({
    status: 409,
    description: 'No second factor is staged to confirm (problem type conflict).',
    content: PROBLEM,
  })
  @ApiResponse(THROTTLED)
  async confirmReenrolment(
    @Body() body: ConfirmAdminReenrolmentRequestDto,
  ): Promise<typeof NO_CONTENT_RESPONSE> {
    await this.credentials.confirmReenrolment(body);
    return NO_CONTENT_RESPONSE;
  }

  @Post('recovery-codes')
  @HttpCode(201)
  @AuditAction({ action: AUDIT_ACTION.ADMIN_RECOVERY_CODES_ISSUED, target: OWN_ACCOUNT })
  @ApiOperation({
    summary: 'Issue a set of recovery codes, replacing any before it',
    description:
      'UC-212 step three. Requires the current password, and answers ten single-use codes, shown once. ' +
      'Every code of an earlier set stops working. Recorded in the system audit log.',
  })
  @ApiObjectResponse(AdminRecoveryCodesResponseDto, {
    status: 201,
    description: 'The new set — the only time the codes are shown.',
  })
  @ApiResponse(SIGNED_OUT)
  @ApiResponse(PASSWORD_REFUSED)
  @ApiResponse(THROTTLED)
  async issueRecoveryCodes(
    @Body() body: AdminReauthenticationRequestDto,
  ): Promise<AdminRecoveryCodesResponseDto> {
    return new AdminRecoveryCodesResponseDto(await this.credentials.issueRecoveryCodes(body));
  }
}
