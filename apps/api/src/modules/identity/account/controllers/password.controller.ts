import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiObjectResponse } from '@api/app/decorators/api-envelope.decorator';
import { RequiresAccount } from '@api/modules/identity/membership/decorators/requires-account.decorator';
import { ChangePasswordRequestDto } from '../dto/change-password.request.dto';
import { PasswordChangedResponseDto } from '../dto/change-password.response.dto';
import { PasswordService } from '../services/password.service';

/**
 * `POST /api/v1/account/password` — FR-7, behind S-28.
 *
 * **Its own controller rather than a route on `AuthController`**, and the reason is the guard.
 * `AuthController` is `@Public()` at class level because every route on it mints or consumes the
 * credential that authenticates everything else; this route is the opposite — it *requires* a
 * session. Adding it there would mean a per-method exception to a class-level decorator, which is
 * the shape a later route quietly inherits the wrong way. It sits beside `TotpController` on
 * `/account/*` instead, which is where task 27.2 put the surface a signed-in person manages their
 * own credentials from.
 *
 * `POST` and not `PUT`: replacing a password is not idempotent, because the second identical
 * request fails — the current password it names is no longer current.
 *
 * No account id in the path. The actor is resolved from the session by `PasswordService`, exactly
 * as `/memberships` and `/account/totp` resolve it; an `{accountId}` segment here would be a
 * second, contradictory source of identity on a route that changes a credential.
 */
@ApiTags('identity')
@Controller('account/password')
@RequiresAccount()
export class PasswordController {
  constructor(private readonly passwordService: PasswordService) {}

  @Post()
  @HttpCode(200)
  @ApiOperation({
    summary: 'Change the signed-in account’s password',
    description:
      'Requires the current password (FR-7). Optionally ends the account’s **other** active ' +
      'sessions — the one making the request is spared, so the device the change was made from ' +
      'keeps working. A provider-only account has no password to change and is refused; setting ' +
      'a first password for one is FR-8’s path.',
  })
  @ApiObjectResponse(PasswordChangedResponseDto, {
    status: 200,
    description: 'The password was replaced, with a count of the other sessions ended.',
  })
  @ApiResponse({
    status: 400,
    description: 'The new password does not meet the policy.',
    content: { 'application/problem+json': {} },
  })
  @ApiResponse({
    status: 403,
    description:
      'The current password is not right, or the account holds none (problem type ' +
      'credential-invalid). Deliberately one answer for both.',
    content: { 'application/problem+json': {} },
  })
  @ApiResponse({
    status: 429,
    description:
      'Too many re-authentication attempts for this account in the window (§12.5.6). It bounds ' +
      'the route without touching FR-4’s lockout, so a mistype here cannot sign the user out.',
    content: { 'application/problem+json': {} },
  })
  async change(@Body() body: ChangePasswordRequestDto): Promise<PasswordChangedResponseDto> {
    return new PasswordChangedResponseDto(await this.passwordService.change(body));
  }
}
