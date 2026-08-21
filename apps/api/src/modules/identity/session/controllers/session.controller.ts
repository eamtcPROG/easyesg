import { Body, Controller, Delete, HttpCode, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiObjectResponse } from '@api/app/decorators/api-envelope.decorator';
import { RefreshSessionRequestDto } from '../dto/refresh-session.request.dto';
import { SessionResponseDto } from '../dto/session.response.dto';
import { SignInRequestDto } from '../dto/sign-in.request.dto';
import { SignOutRequestDto } from '../dto/sign-out.request.dto';
import { SessionService } from '../services/session.service';

/**
 * `/api/v1/auth/session` — sign-in, refresh, sign-out (FR-4, FR-5; UC-04, UC-06; AD-12).
 *
 * The session is the resource: `POST` creates one, `POST /refresh` rotates it, `DELETE` ends it.
 * One surface for both front ends (DR-11, AD-9) — the web proxy and the admin token handler are
 * ordinary callers of these routes, and task 23's `POST /auth/admin/session` (OQ-17) is a
 * sibling route here, not a second mechanism.
 *
 * `AuthController`'s three pattern notes hold; what is specific to this controller:
 *
 *  - **No entitlement gate, recorded rather than omitted**: sign-in precedes any organization
 *    being active, refresh and sign-out act on the session itself, and all three are what the
 *    edge and application throttles (§12.5.6) exist to protect instead.
 *  - **All three routes stay public when `AuthGuard` arrives** (task 28) — they are how a
 *    bearer token comes to exist, and sign-out deliberately authenticates by refresh token so it
 *    works after the access token has expired (UC-07's state).
 */
@ApiTags('identity')
@Controller('auth')
export class SessionController {
  constructor(private readonly sessionService: SessionService) {}

  @Post('session')
  @HttpCode(201)
  @ApiOperation({
    summary: 'Sign in with an email address and a password',
    description:
      'Verifies the credential and issues a session: a short-lived access token and a ' +
      'single-use refresh token. Failures are uniform for unknown addresses and wrong ' +
      'passwords alike, rate-limited per address, and locked out after repeated failure.',
  })
  @ApiObjectResponse(SessionResponseDto, {
    status: 201,
    description: 'The session was issued.',
  })
  @ApiResponse({
    status: 401,
    description:
      'The email address or the password is not right. Deliberately one answer for both, and ' +
      'for a wrong password on an unverified account.',
    content: { 'application/problem+json': {} },
  })
  @ApiResponse({
    status: 403,
    description:
      'The credential is valid but cannot sign in: the address is not verified yet ' +
      '(problem type email-unverified), or the account is locked after repeated failures ' +
      '(problem type account-locked, released by password reset).',
    content: { 'application/problem+json': {} },
  })
  @ApiResponse({
    status: 429,
    description: 'Too many attempts for this address in the window. Identical either way.',
    content: { 'application/problem+json': {} },
  })
  async signIn(@Body() body: SignInRequestDto): Promise<SessionResponseDto> {
    return new SessionResponseDto(await this.sessionService.signIn(body.email, body.password));
  }

  @Post('session/refresh')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Exchange a refresh token for a fresh token pair',
    description:
      'Rotates the session: the presented refresh token is consumed and a successor pair ' +
      'issued. Presenting an already-consumed token is refused; the session stays bounded by ' +
      'its idle and absolute lifetimes.',
  })
  @ApiObjectResponse(SessionResponseDto, {
    status: 200,
    description: 'The rotated session.',
  })
  @ApiResponse({
    status: 401,
    description:
      'The token is not usable (problem type authentication-required), or the session has ' +
      'reached a lifetime bound (problem type session-expired) — the latter is the signal to ' +
      're-authenticate in place with work preserved.',
    content: { 'application/problem+json': {} },
  })
  async refresh(@Body() body: RefreshSessionRequestDto): Promise<SessionResponseDto> {
    return new SessionResponseDto(await this.sessionService.refresh(body.refreshToken));
  }

  @Delete('session')
  @HttpCode(204)
  @ApiOperation({
    summary: 'Sign out',
    description:
      'Terminates the session server-side: the refresh token is dead from here on, whatever ' +
      'copies of it exist. Idempotent, and identical for tokens that were never real — signing ' +
      'out is not an endpoint that confirms anything. Signing out of the platform does not end ' +
      'any session at a social identity provider.',
  })
  @ApiResponse({ status: 204, description: 'The session is terminated, or already was.' })
  async signOut(@Body() body: SignOutRequestDto): Promise<void> {
    await this.sessionService.signOut(body.refreshToken);
  }
}
