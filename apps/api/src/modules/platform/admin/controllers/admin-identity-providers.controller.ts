import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiListResponse, ApiObjectResponse } from '@api/app/decorators/api-envelope.decorator';
import { AUDIT_TARGET, AuditAction } from '@api/app/decorators/audit-action.decorator';
import { SOCIAL_PROVIDER } from '@api/contracts/identity-provider.port';
import { AUDIT_ACTION } from '@api/modules/platform/audit/models/audit-action.model';
import { RequiresAdminRole } from '../decorators/requires-admin-role.decorator';
import { ConfigureIdentityProviderRequestDto } from '../dto/configure-identity-provider.request.dto';
import { IdentityProviderPublicationResponseDto } from '../dto/identity-provider-publication.response.dto';
import { IdentityProviderRevisionRequestDto } from '../dto/identity-provider-revision.request.dto';
import { IdentityProviderResponseDto } from '../dto/identity-provider.response.dto';
import { ADMIN_ROLE } from '../models/admin-session.model';
import { IdentityProvidersService } from '../services/identity-providers.service';

const PROBLEM = { 'application/problem+json': {} };
const PROVIDER = 'provider';
/** Each write names the configuration version it put in force — the id its response carries. */
const PUBLISHED = { from: AUDIT_TARGET.RESULT } as const;

const PROVIDER_PARAM = { name: PROVIDER, enum: Object.values(SOCIAL_PROVIDER), description: 'The provider.' } as const;

const SIGNED_OUT = {
  status: 401,
  description:
    'No usable operator session (problem type authentication-required), or its lifetimes ran out ' +
    '(problem type session-expired).',
  content: PROBLEM,
} as const;

const NOT_PLATFORM_ADMINISTRATOR = {
  status: 403,
  description:
    'The operator’s role is not platform_administrator (problem type insufficient-role), or the request came ' +
    'from an origin other than the console’s.',
  content: PROBLEM,
} as const;

const NO_SUCH_PROVIDER = {
  status: 404,
  description: 'The path names no provider FR-2 offers (problem type not-found).',
  content: PROBLEM,
} as const;

const PUBLISHED_RESPONSE = { status: 201, description: 'The configuration revision now in force.' } as const;

/**
 * `/api/v1/admin/identity-providers` — A-18's social providers (task 67.11; UC-70, FR-82; §12.5.6's task-67.11 row).
 *
 * **Every write publishes a configuration revision** — in force on this replica at once and on the others within
 * the store's poll, with no redeploy — and declares its audit action, naming the version it put in force. **Action
 * nouns, as A-08's lifecycle has them**: a save, an enablement and a disablement have different refusals and
 * different audit actions, and one `PATCH` of an `enabled` field would hide which was asked for from the log.
 * **Nothing here reads or writes a client secret**; the reading says whether one is held and where it is set.
 */
@ApiTags('platform')
@Controller('admin/identity-providers')
@RequiresAdminRole(ADMIN_ROLE.PLATFORM_ADMINISTRATOR)
export class AdminIdentityProvidersController {
  constructor(private readonly providers: IdentityProvidersService) {}

  @Get()
  @ApiOperation({
    summary: 'List the social identity providers and how each is configured',
    description:
      'UC-70. Google and Microsoft, each with its configuration in force and who published it, whether the ' +
      'server holds its client secret and where that is set — never the secret — how many accounts have linked ' +
      'it and how many of those have no other way to sign in, and why it could not be enabled if it could not.',
  })
  @ApiListResponse(IdentityProviderResponseDto, { status: 200, description: 'Both providers, in a fixed order.' })
  @ApiResponse(SIGNED_OUT)
  @ApiResponse(NOT_PLATFORM_ADMINISTRATOR)
  async list(): Promise<IdentityProviderResponseDto[]> {
    return (await this.providers.list()).map((provider) => new IdentityProviderResponseDto(provider));
  }

  @Post(`:${PROVIDER}/configuration`)
  @HttpCode(201)
  @AuditAction({ action: AUDIT_ACTION.ADMIN_IDENTITY_PROVIDER_CONFIGURED, target: PUBLISHED })
  @ApiOperation({
    summary: 'Save a provider’s client ID, issuer and redirect addresses',
    description:
      'UC-70. Publishes a new configuration revision, in force within seconds with no redeploy. Saving the first ' +
      'client ID registers the provider. The enabled state is kept as it is and the scopes are always the three ' +
      'FR-2 names. Recorded in the system audit log.',
  })
  @ApiParam(PROVIDER_PARAM)
  @ApiObjectResponse(IdentityProviderPublicationResponseDto, PUBLISHED_RESPONSE)
  @ApiResponse({
    status: 400,
    description:
      'A field is missing or malformed, the issuer is not a bare https address, or a redirect address does not ' +
      'end in the provider’s callback path (problem type validation-failed).',
    content: PROBLEM,
  })
  @ApiResponse(SIGNED_OUT)
  @ApiResponse(NOT_PLATFORM_ADMINISTRATOR)
  @ApiResponse(NO_SUCH_PROVIDER)
  @ApiResponse({
    status: 409,
    description:
      'A newer revision is in force (problem type identity-provider-changed), the change would leave an enabled ' +
      'provider without a client ID or a redirect address (problem type identity-provider-incomplete), or it ' +
      'changes nothing (problem type conflict).',
    content: PROBLEM,
  })
  async configure(
    @Param(PROVIDER) provider: string,
    @Body() body: ConfigureIdentityProviderRequestDto,
  ): Promise<IdentityProviderPublicationResponseDto> {
    return new IdentityProviderPublicationResponseDto(await this.providers.configure({ ...body, provider }));
  }

  @Post(`:${PROVIDER}/enablement`)
  @HttpCode(201)
  @AuditAction({ action: AUDIT_ACTION.ADMIN_IDENTITY_PROVIDER_ENABLED, target: PUBLISHED })
  @ApiOperation({
    summary: 'Enable a provider',
    description:
      'UC-70. Offers sign-in, registration and linking through the provider from the next request. Refused while ' +
      'the provider could not sign anyone in. Recorded in the system audit log.',
  })
  @ApiParam(PROVIDER_PARAM)
  @ApiObjectResponse(IdentityProviderPublicationResponseDto, PUBLISHED_RESPONSE)
  @ApiResponse(SIGNED_OUT)
  @ApiResponse(NOT_PLATFORM_ADMINISTRATOR)
  @ApiResponse(NO_SUCH_PROVIDER)
  @ApiResponse({
    status: 409,
    description:
      'A newer revision is in force (problem type identity-provider-changed), the provider has no client ID, no ' +
      'redirect address or no client secret held (problem type identity-provider-incomplete), or it is already ' +
      'enabled (problem type conflict).',
    content: PROBLEM,
  })
  async enable(
    @Param(PROVIDER) provider: string,
    @Body() body: IdentityProviderRevisionRequestDto,
  ): Promise<IdentityProviderPublicationResponseDto> {
    return new IdentityProviderPublicationResponseDto(
      await this.providers.changeState({ provider, enabled: true, revision: body.revision }),
    );
  }

  @Post(`:${PROVIDER}/disablement`)
  @HttpCode(201)
  @AuditAction({ action: AUDIT_ACTION.ADMIN_IDENTITY_PROVIDER_DISABLED, target: PUBLISHED })
  @ApiOperation({
    summary: 'Disable a provider',
    description:
      'UC-70, BR-ID-6. Stops new sign-ins, registrations and links through the provider. Signs nobody out, and ' +
      'leaves every account able to sign in with a password — an account holding none sets one through a ' +
      'password reset. Recorded in the system audit log.',
  })
  @ApiParam(PROVIDER_PARAM)
  @ApiObjectResponse(IdentityProviderPublicationResponseDto, PUBLISHED_RESPONSE)
  @ApiResponse(SIGNED_OUT)
  @ApiResponse(NOT_PLATFORM_ADMINISTRATOR)
  @ApiResponse(NO_SUCH_PROVIDER)
  @ApiResponse({
    status: 409,
    description:
      'A newer revision is in force (problem type identity-provider-changed), or the provider is already disabled ' +
      '(problem type conflict).',
    content: PROBLEM,
  })
  async disable(
    @Param(PROVIDER) provider: string,
    @Body() body: IdentityProviderRevisionRequestDto,
  ): Promise<IdentityProviderPublicationResponseDto> {
    return new IdentityProviderPublicationResponseDto(
      await this.providers.changeState({ provider, enabled: false, revision: body.revision }),
    );
  }
}
