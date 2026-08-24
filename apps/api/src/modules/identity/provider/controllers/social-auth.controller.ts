import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiObjectResponse } from '@api/app/decorators/api-envelope.decorator';
import { SOCIAL_PROVIDER } from '@api/contracts/identity-provider.port';
import { SessionResponseDto } from '@api/modules/identity/session/dto/session.response.dto';
import { CompleteSocialSignInRequestDto } from '../dto/complete-social-sign-in.request.dto';
import { SocialChallengeRequestDto } from '../dto/social-challenge.request.dto';
import { SocialChallengeResponseDto } from '../dto/social-challenge.response.dto';
import { SocialProvidersResponseDto } from '../dto/social-providers.response.dto';
import { SocialAuthService } from '../services/social-auth.service';

/**
 * `/api/v1/auth/social` — provider sign-in and registration (FR-2, FR-4, FR-82; UC-02, UC-05;
 * task 24, §12.5.6's task-24 rows).
 *
 * The api's half is a back channel: the browser-facing redirect endpoints live on `apps/web`,
 * which begins a flow here, holds the challenge across the redirect in a sealed cookie, and
 * completes it here. Both mutating routes stay public when `AuthGuard` arrives (task 28) — they
 * are how a session comes to exist. `{provider}` is a path parameter rather than a body field
 * because the two providers are two resources of one shape (and the OpenAPI enum keeps the set
 * closed on the wire).
 */
@ApiTags('identity')
@Controller('auth/social')
export class SocialAuthController {
  constructor(private readonly socialAuthService: SocialAuthService) {}

  @Get('providers')
  @ApiOperation({
    summary: 'List the identity providers currently accepting sign-in',
    description:
      'The set the sign-in screen renders. Providers are enabled and disabled through ' +
      'configuration without a redeploy; a disabled provider disappears from here and refuses ' +
      'both sign-in and registration.',
  })
  @ApiObjectResponse(SocialProvidersResponseDto, {
    status: 200,
    description: 'The currently enabled providers.',
  })
  providers(): SocialProvidersResponseDto {
    return new SocialProvidersResponseDto(this.socialAuthService.enabledProviders());
  }

  @Post(':provider/challenge')
  @HttpCode(200)
  @ApiParam({ name: 'provider', enum: Object.values(SOCIAL_PROVIDER) })
  @ApiOperation({
    summary: 'Begin a provider sign-in',
    description:
      'Builds the authorization redirect for the provider. The caller sends the browser to ' +
      '`authorizationUrl` and must hold `state`, `nonce` and `codeVerifier` server-side across ' +
      'the redirect — they bind the callback to this challenge and are required to complete it.',
  })
  @ApiObjectResponse(SocialChallengeResponseDto, {
    status: 200,
    description: 'The authorization challenge.',
  })
  @ApiResponse({
    status: 403,
    description:
      'The provider is not available for sign-in (problem type social-provider-unavailable). ' +
      'Identical for a provider that is disabled and one that is not registered.',
    content: { 'application/problem+json': {} },
  })
  @ApiResponse({
    status: 400,
    description:
      'The redirect URI is not within the provider’s registered redirect configuration ' +
      '(problem type social-redirect-rejected).',
    content: { 'application/problem+json': {} },
  })
  async challenge(
    @Param('provider') provider: string,
    @Body() body: SocialChallengeRequestDto,
  ): Promise<SocialChallengeResponseDto> {
    return new SocialChallengeResponseDto(
      await this.socialAuthService.begin({ provider, redirectUri: body.redirectUri }),
    );
  }

  @Post(':provider/session')
  @HttpCode(201)
  @ApiParam({ name: 'provider', enum: Object.values(SOCIAL_PROVIDER) })
  @ApiOperation({
    summary: 'Complete a provider sign-in',
    description:
      'Redeems the authorization code, validates the identity assertion, and issues the same ' +
      'session shape as password sign-in — matching on the provider’s stable subject ' +
      'identifier, never on the email address. A first-time identity registers when the flow ' +
      'began as registration; a sign-in that matches nothing is answered distinctly so ' +
      'registration can be offered instead.',
  })
  @ApiObjectResponse(SessionResponseDto, {
    status: 201,
    description: 'The session was issued.',
  })
  @ApiResponse({
    status: 401,
    description:
      'The exchange failed (problem type social-exchange-failed), or the identity is linked to ' +
      'no account and the flow began as sign-in — see 404.',
    content: { 'application/problem+json': {} },
  })
  @ApiResponse({
    status: 404,
    description:
      'The authenticated identity is linked to no account (problem type ' +
      'social-identity-unknown). Nothing was created; the caller offers registration.',
    content: { 'application/problem+json': {} },
  })
  @ApiResponse({
    status: 403,
    description:
      'The provider is unavailable (problem type social-provider-unavailable), or the account ' +
      'awaits email verification (problem type email-unverified) — for a fresh ' +
      'registration whose provider did not assert the address verified, the account exists and ' +
      'the verification email is on its way when this answers.',
    content: { 'application/problem+json': {} },
  })
  @ApiResponse({
    status: 409,
    description:
      'The asserted address already has an account (problem type social-email-in-use). A ' +
      'provider assertion alone never attaches to an existing account; the resolution is ' +
      'password sign-in.',
    content: { 'application/problem+json': {} },
  })
  @ApiResponse({
    status: 429,
    description: 'Too many completion attempts from this address in the window.',
    content: { 'application/problem+json': {} },
  })
  async session(
    @Param('provider') provider: string,
    @Body() body: CompleteSocialSignInRequestDto,
  ): Promise<SessionResponseDto> {
    return new SessionResponseDto(
      await this.socialAuthService.complete({
        provider,
        code: body.code,
        state: body.state,
        nonce: body.nonce,
        codeVerifier: body.codeVerifier,
        redirectUri: body.redirectUri,
        intent: body.intent,
      }),
    );
  }
}
