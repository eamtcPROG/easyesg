import { Controller, Get, HttpCode, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiObjectResponse } from '@api/app/decorators/api-envelope.decorator';
import { NO_CONTENT_RESPONSE } from '@api/app/interceptors/global-response.interceptor';
import { RequiresRole } from '@api/modules/identity/membership/decorators/requires-role.decorator';
import { MEMBERSHIP_ROLE } from '@api/modules/identity/membership/models/membership.model';
import { OrganizationSupportAccessResponseDto } from '../dto/organization-support-access.response.dto';
import { OrganizationSupportAccessService } from '../services/organization-support-access.service';

const PROBLEM = { 'application/problem+json': {} };
const REQUEST_ID = 'requestId';

const NO_SUCH_REQUEST = {
  status: 404,
  description: 'The organization has no such request (problem type not-found).',
  content: PROBLEM,
} as const;

/**
 * `/api/v1/support-access` — support access, the organization's side (task 67.9; UC-85, UX-124; FR-78 amended
 * 14 Sep 2026): **consent is the organization's**.
 *
 * **Every member reads whether EasyESG holds access right now**, because the banner is everyone's; **only an
 * Organization Administrator answers a request or ends running access**. The routes carry no audit action: they
 * are tenant writes, and their record is the support access log's own row, which names the member who wrote it.
 */
@ApiTags('platform')
@Controller('support-access')
export class OrganizationSupportAccessController {
  constructor(private readonly supportAccess: OrganizationSupportAccessService) {}

  @Get()
  @RequiresRole(
    MEMBERSHIP_ROLE.ORGANIZATION_ADMINISTRATOR,
    MEMBERSHIP_ROLE.EDITOR,
    MEMBERSHIP_ROLE.VIEWER,
  )
  @ApiOperation({
    summary: 'Whether EasyESG support is reading the organization, or asking to',
    description:
      'Access running now, which every member is shown, and — for an Organization Administrator — the requests ' +
      'waiting for an answer.',
  })
  @ApiObjectResponse(OrganizationSupportAccessResponseDto, { status: 200, description: 'The organization’s support access.' })
  async current(): Promise<OrganizationSupportAccessResponseDto> {
    return new OrganizationSupportAccessResponseDto(await this.supportAccess.current());
  }

  @Post(`:${REQUEST_ID}/grant`)
  @HttpCode(204)
  @RequiresRole(MEMBERSHIP_ROLE.ORGANIZATION_ADMINISTRATOR)
  @ApiOperation({
    summary: 'Grant a support-access request',
    description:
      'Lets the Platform Administrator who asked read the organization’s reports, read-only, for 60 minutes. ' +
      'Every member sees it while it runs, and any Organization Administrator can end it.',
  })
  @ApiParam({ name: REQUEST_ID, format: 'uuid' })
  @ApiResponse({ status: 204, description: 'Granted.' })
  @ApiResponse(NO_SUCH_REQUEST)
  @ApiResponse({
    status: 409,
    description: 'The request is no longer waiting — answered already, or lapsed (problem type conflict).',
    content: PROBLEM,
  })
  async grant(@Param(REQUEST_ID, ParseUUIDPipe) requestId: string): Promise<typeof NO_CONTENT_RESPONSE> {
    await this.supportAccess.grant({ requestId });
    return NO_CONTENT_RESPONSE;
  }

  @Post(`:${REQUEST_ID}/decline`)
  @HttpCode(204)
  @RequiresRole(MEMBERSHIP_ROLE.ORGANIZATION_ADMINISTRATOR)
  @ApiOperation({
    summary: 'Decline a support-access request',
    description: 'Nothing is read. The operator sees the request declined.',
  })
  @ApiParam({ name: REQUEST_ID, format: 'uuid' })
  @ApiResponse({ status: 204, description: 'Declined.' })
  @ApiResponse(NO_SUCH_REQUEST)
  @ApiResponse({
    status: 409,
    description: 'The request is no longer waiting — answered already, or lapsed (problem type conflict).',
    content: PROBLEM,
  })
  async decline(@Param(REQUEST_ID, ParseUUIDPipe) requestId: string): Promise<typeof NO_CONTENT_RESPONSE> {
    await this.supportAccess.decline({ requestId });
    return NO_CONTENT_RESPONSE;
  }

  @Post(`:${REQUEST_ID}/end`)
  @HttpCode(204)
  @RequiresRole(MEMBERSHIP_ROLE.ORGANIZATION_ADMINISTRATOR)
  @ApiOperation({
    summary: 'End running support access',
    description: 'The grant stops at once, before its 60 minutes; the operator can read nothing more under it.',
  })
  @ApiParam({ name: REQUEST_ID, format: 'uuid' })
  @ApiResponse({ status: 204, description: 'Ended.' })
  @ApiResponse(NO_SUCH_REQUEST)
  @ApiResponse({
    status: 409,
    description: 'The access is not running — never granted, ended already, or expired (problem type conflict).',
    content: PROBLEM,
  })
  async end(@Param(REQUEST_ID, ParseUUIDPipe) requestId: string): Promise<typeof NO_CONTENT_RESPONSE> {
    await this.supportAccess.end({ requestId });
    return NO_CONTENT_RESPONSE;
  }
}
