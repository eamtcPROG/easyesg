import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiObjectResponse } from '@api/app/decorators/api-envelope.decorator';
import { AccountResponseDto } from '../dto/account.response.dto';
import { RegisterAccountRequestDto } from '../dto/register-account.request.dto';
import { RequestPasswordResetRequestDto } from '../dto/request-password-reset.request.dto';
import { ResendVerificationEmailRequestDto } from '../dto/resend-verification-email.request.dto';
import { ResetPasswordRequestDto } from '../dto/reset-password.request.dto';
import { VerifyEmailRequestDto } from '../dto/verify-email.request.dto';
import { AccountService } from '../services/account.service';

/**
 * `/api/v1/auth` — registration, verification and password reset (FR-1, FR-3, FR-6; UC-01,
 * UC-03, UC-08, UC-09 — FR-6 assigned to task 21 by OQ-56).
 *
 * The first controller in the product beyond health, so three things about it are the pattern
 * rather than incidental:
 *
 *  - **It is thin, and it calls the SERVICE, never a use case** (house rule, 20 Aug 2026). It
 *    maps transport to `AccountService` and the result to a DTO, and holds no decision of its
 *    own; orchestration and ambient-context resolution live in the service, and the flows
 *    themselves read as `use_cases.md` entries in `use-cases/`.
 *  - **It returns plain data.** `GlobalResponseInterceptor` wraps it in the envelope and
 *    `ProblemDetailsFilter` shapes every failure as problem+json; a controller that built either
 *    would be the start of a second response shape (§6.8).
 *  - **No entitlement gate, recorded rather than omitted** (`apps/api/CLAUDE.md`). Both routes run
 *    before any organization exists, so there is no tenant to hold a plan and nothing for
 *    `EntitlementGuard` to evaluate. They are also unauthenticated by necessity, which is what
 *    makes the edge rate limit (§12.5.6) the control on them — and on `register` specifically that
 *    limit is load-bearing, because OQ-53 chose a truthful `409` over a uniform response.
 *
 * These routes stay public when `AuthGuard` arrives in task 28. They will need its `@Public()`
 * marker; there is nothing to mark them with yet, and inventing the decorator ahead of the guard
 * would be a marker nothing reads.
 */
@ApiTags('identity')
@Controller('auth')
export class AuthController {
  constructor(private readonly accountService: AccountService) {}

  @Post('register')
  @HttpCode(201)
  @ApiOperation({
    summary: 'Register an account with an email address and a password',
    description:
      'Creates an unverified account and issues a verification challenge by email. No ' +
      'application data is reachable until verification completes.',
  })
  @ApiObjectResponse(AccountResponseDto, {
    status: 201,
    description: 'The account was created and a verification email was queued.',
  })
  @ApiResponse({
    status: 400,
    description: 'The password does not meet the policy, or the address is malformed.',
    content: { 'application/problem+json': {} },
  })
  @ApiResponse({
    status: 409,
    description: 'The address already holds an account.',
    content: { 'application/problem+json': {} },
  })
  async register(@Body() body: RegisterAccountRequestDto): Promise<AccountResponseDto> {
    return new AccountResponseDto(await this.accountService.register(body));
  }

  @Post('verify-email')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Verify control of a registered email address',
    description:
      'Consumes the single-use token from the verification link and activates the account. The ' +
      'token is sent in the body rather than followed as a link so that a mail scanner opening ' +
      'the URL cannot consume it.',
  })
  @ApiObjectResponse(AccountResponseDto, {
    status: 200,
    description: 'The account is active.',
  })
  @ApiResponse({
    status: 400,
    description:
      'The link is not valid — never issued, already used, expired, or belonging to an account ' +
      'that has itself expired. The four are deliberately indistinguishable.',
    content: { 'application/problem+json': {} },
  })
  async verify(@Body() body: VerifyEmailRequestDto): Promise<AccountResponseDto> {
    return new AccountResponseDto(await this.accountService.verify(body));
  }

  @Post('verification-email')
  @HttpCode(202)
  @ApiOperation({
    summary: 'Request a new verification link',
    description:
      'Sends a fresh confirmation link if the address holds an unverified account, and does ' +
      'nothing otherwise. The response is identical in every case, so it cannot be used to ' +
      'discover whether an address is registered.',
  })
  @ApiResponse({
    status: 202,
    description:
      'Accepted. Empty by design — a body describing what happened would be the disclosure this ' +
      'endpoint exists without.',
  })
  @ApiResponse({
    status: 400,
    description:
      'The address is malformed. A statement about the request, not about whether an account ' +
      'exists.',
    content: { 'application/problem+json': {} },
  })
  async resend(@Body() body: ResendVerificationEmailRequestDto): Promise<void> {
    await this.accountService.resend(body);
  }

  @Post('password-reset-email')
  @HttpCode(202)
  @ApiOperation({
    summary: 'Request a password reset link',
    description:
      'Sends a single-use, time-limited reset link if the address holds a verified account, ' +
      'and does nothing otherwise. The response is identical in every case. Requests are ' +
      'rate-limited per address; a locked account may always request one — consuming the ' +
      'link is what releases the lock.',
  })
  @ApiResponse({
    status: 202,
    description:
      'Accepted. Empty by design, for the same reason as the verification resend: a body ' +
      'describing what happened would be the disclosure this endpoint exists without.',
  })
  @ApiResponse({
    status: 400,
    description: 'The address is malformed. A statement about the request, not about accounts.',
    content: { 'application/problem+json': {} },
  })
  @ApiResponse({
    status: 429,
    description: 'Too many requests for this address in the window. Identical either way.',
    content: { 'application/problem+json': {} },
  })
  async requestPasswordReset(@Body() body: RequestPasswordResetRequestDto): Promise<void> {
    await this.accountService.requestPasswordReset(body);
  }

  @Post('password-reset')
  @HttpCode(204)
  @ApiOperation({
    summary: 'Set a new password with a reset link',
    description:
      'Consumes the single-use token and replaces the password. Every existing session for ' +
      'the account is terminated, and a lockout, if one stood, is released. The token is sent ' +
      'in the body rather than followed as a link so a mail scanner cannot consume it. ' +
      'No session is issued: sign in with the new password.',
  })
  @ApiResponse({ status: 204, description: 'The password is replaced. Sign in to continue.' })
  @ApiResponse({
    status: 400,
    description:
      'The password does not meet the policy, or the link is not valid — never issued, already ' +
      'used, expired, or superseded by a newer request. The four are deliberately ' +
      'indistinguishable.',
    content: { 'application/problem+json': {} },
  })
  async resetPassword(@Body() body: ResetPasswordRequestDto): Promise<void> {
    await this.accountService.resetPassword(body);
  }
}
