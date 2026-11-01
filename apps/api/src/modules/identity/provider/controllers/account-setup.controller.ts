import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiObjectResponse } from '@api/app/decorators/api-envelope.decorator';
import { AdmitsAccountInSetup } from '@api/modules/identity/session/decorators/admits-account-in-setup.decorator';
import { AccountSetupResponseDto } from '../dto/account-setup.response.dto';
import { SaveSetupProfileRequestDto } from '../dto/save-setup-profile.request.dto';
import { SetFirstPasswordRequestDto } from '../dto/set-first-password.request.dto';
import { AccountSetupService } from '../services/account-setup.service';

/**
 * `/api/v1/account/setup` — an account's setup (task 155; §12.5.6's task-155 row, S-36).
 *
 * **The only session-bearing routes an account in setup reaches**, which is what
 * `@AdmitsAccountInSetup` declares at the class: every other one refuses it with
 * `account-setup-required`. They stay open to an active account too — its read says it is complete,
 * and its writes are refused as such — because a gate that answered an active account differently
 * would be a second place the setup state is judged.
 *
 * No account id in the path, for `PasswordController`'s reason: the actor comes from the session.
 *
 * **No entitlement gate, and none is owed** (`apps/api/CLAUDE.md`, *Before you add a route*): an
 * account completes its own setup before it belongs to any organization, so no plan's entitlement can
 * key these routes.
 */
@ApiTags('identity')
@Controller('account/setup')
@AdmitsAccountInSetup()
export class AccountSetupController {
  constructor(private readonly accountSetupService: AccountSetupService) {}

  @Get()
  @ApiOperation({
    summary: 'Read the signed-in account’s setup',
    description:
      'Which of the two steps the account still owes — a password, and its given name, family name ' +
      'and interface language — with the values to pre-fill. An active account is told it is complete.',
  })
  @ApiObjectResponse(AccountSetupResponseDto, {
    status: 200,
    description: 'The account’s setup as it stands.',
  })
  async read(): Promise<AccountSetupResponseDto> {
    return new AccountSetupResponseDto(await this.accountSetupService.read());
  }

  @Post('password')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Set the first password of an account in setup',
    description:
      'There is no current password to ask for, so the proof is recent: the session must come from a ' +
      'provider sign-in made within the last 15 minutes. The account becomes active if it already ' +
      'holds both name parts.',
  })
  @ApiObjectResponse(AccountSetupResponseDto, {
    status: 200,
    description: 'The password is set; the setup as it now stands.',
  })
  @ApiResponse({
    status: 400,
    description: 'The password does not meet the policy.',
    content: { 'application/problem+json': {} },
  })
  @ApiResponse({
    status: 403,
    description:
      'The sign-in behind this session is 15 minutes old or more (problem type ' +
      'account-setup-proof-stale). Sign in with the provider again, then set the password.',
    content: { 'application/problem+json': {} },
  })
  @ApiResponse({
    status: 409,
    description: 'The account is not in setup, or already holds a password.',
    content: { 'application/problem+json': {} },
  })
  async setPassword(@Body() body: SetFirstPasswordRequestDto): Promise<AccountSetupResponseDto> {
    return new AccountSetupResponseDto(await this.accountSetupService.setFirstPassword(body));
  }

  @Post('profile')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Save the name and language of an account in setup',
    description:
      'Both name parts and the interface language. Usable only while the account is in setup; the ' +
      'account becomes active if it already holds a password.',
  })
  @ApiObjectResponse(AccountSetupResponseDto, {
    status: 200,
    description: 'The name and language are saved; the setup as it now stands.',
  })
  @ApiResponse({
    status: 400,
    description: 'A name part is missing, only whitespace, or too long, or the language is not offered.',
    content: { 'application/problem+json': {} },
  })
  @ApiResponse({
    status: 409,
    description: 'The account is not in setup.',
    content: { 'application/problem+json': {} },
  })
  async saveProfile(@Body() body: SaveSetupProfileRequestDto): Promise<AccountSetupResponseDto> {
    return new AccountSetupResponseDto(await this.accountSetupService.saveProfile(body));
  }
}
