import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiObjectResponse } from '@api/app/decorators/api-envelope.decorator';
import { RequiresAccount } from '@api/modules/identity/membership/decorators/requires-account.decorator';
import {
  ConfirmTotpRequestDto,
  TotpReauthenticationRequestDto,
} from '../dto/totp.request.dto';
import {
  RecoveryCodesResponseDto,
  TotpEnrolmentResponseDto,
  TotpStateResponseDto,
} from '../dto/totp.response.dto';
import { TotpService } from '../services/totp.service';

/**
 * `/api/v1/account/totp` — the opt-in second factor (NFR-95, UC-193; task 27.2), behind S-28.
 *
 * **Every route is an action noun rather than a verb on the collection, and the reason is one
 * awkward HTTP fact.** Disenrolment and re-issue both require the current password, so both need a
 * body; `DELETE` with a body is legal and unevenly supported through proxies, which is not a thing
 * to discover in production on the route that turns a security control off. `POST .../removal`
 * follows the precedent task 26.2 set with `POST /invitations/{preview,acceptance}` — a
 * sub-resource named for what happens — and sidesteps it entirely.
 *
 * **No account id appears anywhere in these paths.** The actor is resolved from the session by
 * `TotpService`, exactly as `/memberships` resolves it: an `{accountId}` segment here would be a
 * second, contradictory source of identity on the routes where it matters most.
 *
 * `@RequiresAccount()` and not `@RequiresRole()`: a second factor belongs to a person, not to an
 * organization, and NFR-95 offers it to every tenant user. It is reachable before any organization
 * is bound, which is also why it lives in `identity/account` — the module that owns credentials —
 * rather than anywhere tenant-scoped.
 *
 * The **challenge** is deliberately absent. Answering a factor happens during sign-in and belongs
 * to `identity/session` (UC-194, UC-195; task 27.3); this controller is where the factor is
 * *managed*, which is the split `design_spec.md` draws between S-28 and S-01.
 */
/** Repeated on three routes; sonarjs counts it and the rule is right — one place to change it. */
const CURRENT_PASSWORD_REFUSED =
  'The current password did not match (problem type credential-invalid).';

@ApiTags('identity')
@Controller('account/totp')
@RequiresAccount()
export class TotpController {
  constructor(private readonly totpService: TotpService) {}

  @Get()
  @ApiOperation({
    summary: 'Whether this account has a second factor, and how many recovery codes remain',
    description:
      'What S-28 reads. It carries neither the secret nor the codes: both exist outside the ' +
      'user’s own keeping only at the moment they are issued.',
  })
  @ApiObjectResponse(TotpStateResponseDto, {
    status: 200,
    description: 'The account’s second-factor state.',
  })
  async state(): Promise<TotpStateResponseDto> {
    return new TotpStateResponseDto(await this.totpService.state());
  }

  @Post('enrolment')
  @HttpCode(201)
  @ApiOperation({
    summary: 'Begin enrolling a second factor',
    description:
      'Issues a secret for the authenticator to capture. **The factor is not yet in force** — it ' +
      'activates only when a current code confirms the capture, because a secret an authenticator ' +
      'failed to record would otherwise leave the account demanding a code no device can produce. ' +
      'Requires the current password, since a second factor is the control that survives a ' +
      'compromised session and a compromised session must not be able to install one.',
  })
  @ApiObjectResponse(TotpEnrolmentResponseDto, {
    status: 201,
    description: 'The secret and its enrolment URI, returned exactly once.',
  })
  @ApiResponse({
    status: 403,
    description: CURRENT_PASSWORD_REFUSED,
    content: { 'application/problem+json': {} },
  })
  @ApiResponse({
    status: 409,
    description: 'A confirmed factor already exists; turn it off before enrolling another.',
    content: { 'application/problem+json': {} },
  })
  async begin(@Body() body: TotpReauthenticationRequestDto): Promise<TotpEnrolmentResponseDto> {
    return new TotpEnrolmentResponseDto(await this.totpService.begin(body));
  }

  @Post('confirmation')
  @HttpCode(201)
  @ApiOperation({
    summary: 'Confirm the enrolment with a current code, and receive the recovery codes',
    description:
      'Activates the factor and issues the recovery codes, which are shown exactly once. No ' +
      'password here: the enrolment step took it moments ago, and a current code from the secret ' +
      'just issued is stronger evidence than a password for the thing being proved.',
  })
  @ApiObjectResponse(RecoveryCodesResponseDto, {
    status: 201,
    description: 'The factor is in force, and these are its recovery codes.',
  })
  @ApiResponse({
    status: 403,
    description: 'The code is not current for the issued secret (problem type factor-invalid).',
    content: { 'application/problem+json': {} },
  })
  @ApiResponse({
    status: 409,
    description: 'There is no enrolment awaiting confirmation.',
    content: { 'application/problem+json': {} },
  })
  async confirm(@Body() body: ConfirmTotpRequestDto): Promise<RecoveryCodesResponseDto> {
    return new RecoveryCodesResponseDto(await this.totpService.confirm(body));
  }

  @Post('removal')
  @HttpCode(204)
  @ApiOperation({
    summary: 'Turn the second factor off',
    description:
      'Removes the factor and its recovery codes together — a code left behind would sign in ' +
      'against a factor that no longer exists. Requires the current password. NFR-95 is opt-in, ' +
      'and an opt-in that cannot be reversed is not one.',
  })
  @ApiResponse({ status: 204, description: 'The factor and its recovery codes are gone.' })
  @ApiResponse({
    status: 403,
    description: CURRENT_PASSWORD_REFUSED,
    content: { 'application/problem+json': {} },
  })
  @ApiResponse({
    status: 409,
    description: 'The account has no second factor.',
    content: { 'application/problem+json': {} },
  })
  async remove(@Body() body: TotpReauthenticationRequestDto): Promise<void> {
    await this.totpService.disable(body);
  }

  @Post('recovery-codes')
  @HttpCode(201)
  @ApiOperation({
    summary: 'Replace the recovery codes with a fresh set',
    description:
      'Replaces the whole set rather than topping it up, so a user who re-issues because they ' +
      'believe a code leaked does not leave the leaked one live. Requires the current password.',
  })
  @ApiObjectResponse(RecoveryCodesResponseDto, {
    status: 201,
    description: 'The new set. Every previous code is now dead.',
  })
  @ApiResponse({
    status: 403,
    description: CURRENT_PASSWORD_REFUSED,
    content: { 'application/problem+json': {} },
  })
  @ApiResponse({
    status: 409,
    description: 'The account has no confirmed second factor.',
    content: { 'application/problem+json': {} },
  })
  async reissue(@Body() body: TotpReauthenticationRequestDto): Promise<RecoveryCodesResponseDto> {
    return new RecoveryCodesResponseDto(await this.totpService.reissueRecoveryCodes(body));
  }
}
