import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '@api/app/decorators/public.decorator';
import { ApiObjectResponse } from '@api/app/decorators/api-envelope.decorator';
import { SessionResponseDto } from '@api/modules/identity/session/dto/session.response.dto';
import { SetFirstPasswordByGrantRequestDto } from '../dto/set-first-password-by-grant.request.dto';
import { AccountSetupService } from '../services/account-setup.service';

/**
 * `POST /api/v1/auth/account-setup/password` — the confirmation link's first password (task 155;
 * §12.5.6's task-155 row (4)).
 *
 * **Its own controller, and public**, for `PasswordController`'s argument turned around: every route on
 * `AccountSetupController` needs a session, and this one is how the account gets its first — the
 * single-use grant `POST /auth/verify-email` answered with is the caller's whole standing. A per-method
 * `@Public()` beside a class-level gate is the shape a later route inherits the wrong way.
 *
 * **No entitlement gate, and none is owed** (`apps/api/CLAUDE.md`, *Before you add a route*): an
 * account's first password comes before it belongs to any organization, so there is no plan whose
 * entitlement could key the route — the grant is the whole of the check.
 */
@ApiTags('identity')
@Controller('auth/account-setup')
@Public()
export class AccountSetupGrantController {
  constructor(private readonly accountSetupService: AccountSetupService) {}

  @Post('password')
  @HttpCode(201)
  @ApiOperation({
    summary: 'Set the first password with the grant an address confirmation answered with',
    description:
      'For an account registered through a provider that did not confirm the address: the ' +
      'confirmation opens the password step for 15 minutes. The grant works once; the person is ' +
      'signed in once the password is set, with the same session shape as any other sign-in.',
  })
  @ApiObjectResponse(SessionResponseDto, {
    status: 201,
    description: 'The password is set and the session issued.',
  })
  @ApiResponse({
    status: 400,
    description: 'The password does not meet the policy, or the grant is malformed.',
    content: { 'application/problem+json': {} },
  })
  @ApiResponse({
    status: 403,
    description:
      'The grant is not usable — unknown, already used, past its 15 minutes, or its account passed its ' +
      'setup deadline (problem type account-setup-proof-stale). Sign in with the provider, or request ' +
      'a password link.',
    content: { 'application/problem+json': {} },
  })
  @ApiResponse({
    status: 409,
    description: 'The account is not in setup, or already holds a password.',
    content: { 'application/problem+json': {} },
  })
  async setPassword(@Body() body: SetFirstPasswordByGrantRequestDto): Promise<SessionResponseDto> {
    return new SessionResponseDto(await this.accountSetupService.setFirstPasswordByGrant(body));
  }
}
