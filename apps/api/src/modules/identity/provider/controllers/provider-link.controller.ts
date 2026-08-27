import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiListResponse } from '@api/app/decorators/api-envelope.decorator';
import { SOCIAL_PROVIDER, type SocialProvider } from '@api/contracts/identity-provider.port';
import { RequiresAccount } from '@api/modules/identity/membership/decorators/requires-account.decorator';
import {
  LinkProviderRequestDto,
  UnlinkProviderRequestDto,
} from '../dto/link-provider.request.dto';
import { LinkedProviderResponseDto } from '../dto/linked-provider.response.dto';
import { ProviderLinkService } from '../services/provider-link.service';

/**
 * `/api/v1/account/providers` — FR-8's link and unlink (UC-11, UC-12), behind S-28.
 *
 * **The authorization half is not here, and that is the design.** A link *begins* at
 * `POST /auth/social/{provider}/challenge`, exactly as a sign-in does: that route builds an
 * authorization URL from a provider and a redirect URI and knows nothing about who is asking. Only
 * the redemption differs, and it differs because it must be authenticated — which `@Public()` makes
 * impossible on the `/auth/social` controller, since it short-circuits `AuthGuard` before any token
 * is read. `SOCIAL_SIGN_IN_INTENT.LINK` is what tells the web tier's sealed transaction to come
 * back *here* rather than to `/auth/social/{provider}/session`.
 *
 * `POST .../removal` rather than `DELETE`: unlink carries a password, and `DELETE` with a body is
 * unevenly supported through proxies — the same reasoning task 27.2 applied to turning off a second
 * factor, and for the same kind of route.
 */
@ApiTags('identity')
@Controller('account/providers')
@RequiresAccount()
export class ProviderLinkController {
  constructor(private readonly providerLinkService: ProviderLinkService) {}

  @Get()
  @ApiOperation({
    summary: 'The providers linked to the signed-in account',
    description:
      'What S-28 lists. The provider’s subject identifier is deliberately not included: it is the ' +
      'provider’s own identifier for a person and no screen has a use for it.',
  })
  @ApiListResponse(LinkedProviderResponseDto, {
    status: 200,
    description: 'The linked providers, ordered by provider.',
  })
  async linked(): Promise<LinkedProviderResponseDto[]> {
    return (await this.providerLinkService.linked()).map(
      (identity) => new LinkedProviderResponseDto(identity),
    );
  }

  @Post(':provider')
  @HttpCode(201)
  @ApiParam({ name: 'provider', enum: Object.values(SOCIAL_PROVIDER) })
  @ApiOperation({
    summary: 'Link a provider identity to the signed-in account',
    description:
      'Redeems the authorization code and attaches what the provider asserts (UC-11). Requires ' +
      'the current password: a link adds a way in, so a stolen session must not be able to attach ' +
      'one and outlive the password change its owner would reach for. **The asserted address need ' +
      'not match the account’s** — a personal provider account is routinely not a work address, ' +
      'and BR-ID-3 is satisfied by the re-authentication, never by comparing emails.',
  })
  @ApiResponse({ status: 201, description: 'The provider is linked.' })
  @ApiResponse({
    status: 403,
    description: 'The current password did not match (problem type credential-invalid).',
    content: { 'application/problem+json': {} },
  })
  @ApiResponse({
    status: 409,
    description:
      'That provider identity is already attached to an account, or this account already holds ' +
      'one for this provider. Deliberately one answer for both — the other would name a ' +
      'stranger’s account.',
    content: { 'application/problem+json': {} },
  })
  @ApiResponse({
    status: 429,
    description: 'Too many re-authentication attempts for this account in the window (§12.5.6).',
    content: { 'application/problem+json': {} },
  })
  async link(
    @Param('provider') provider: SocialProvider,
    @Body() body: LinkProviderRequestDto,
  ): Promise<void> {
    await this.providerLinkService.link({ ...body, provider });
  }

  @Post(':provider/removal')
  @HttpCode(204)
  @ApiParam({ name: 'provider', enum: Object.values(SOCIAL_PROVIDER) })
  @ApiOperation({
    summary: 'Unlink a provider identity',
    description:
      'Removes the identity (UC-12), unless it is the account’s **last remaining credential** — ' +
      'BR-ID-4, counted across the password and every linked provider rather than assumed. An ' +
      'account with no usable credential is unrecoverable and takes its organization memberships ' +
      'with it, so the refusal names the way out: set a password first.',
  })
  @ApiResponse({ status: 204, description: 'The provider is no longer linked.' })
  @ApiResponse({
    status: 403,
    description: 'The current password did not match (problem type credential-invalid).',
    content: { 'application/problem+json': {} },
  })
  @ApiResponse({
    status: 409,
    description:
      'The account holds no identity for that provider, or removing it would leave no credential ' +
      'at all (BR-ID-4).',
    content: { 'application/problem+json': {} },
  })
  async unlink(
    @Param('provider') provider: SocialProvider,
    @Body() body: UnlinkProviderRequestDto,
  ): Promise<void> {
    await this.providerLinkService.unlink({ ...body, provider });
  }
}
