import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiListResponse } from '@api/app/decorators/api-envelope.decorator';
import { RequiresAdminRole } from '../decorators/requires-admin-role.decorator';
import { OrganizationEntityResponseDto } from '../dto/organization-entity.response.dto';
import { ADMIN_ROLE } from '../models/admin-session.model';
import { OrganizationEntitiesService } from '../services/organization-entities.service';

const PROBLEM = { 'application/problem+json': {} };
const ORGANIZATION_ID = 'organizationId';

/**
 * `/api/v1/admin/organizations/:organizationId/entities` — A-02's record's entities (task 175; UC-69, FR-16, FR-76):
 * which companies an account reports for and the IDNO each holds, since the register row shows one IDNO and a group
 * holds several. **A Platform Administrator's**, like the register, **read through `esg_admin_ro` and logged before it
 * reads.**
 */
@ApiTags('platform')
@Controller(`admin/organizations/:${ORGANIZATION_ID}/entities`)
@RequiresAdminRole(ADMIN_ROLE.PLATFORM_ADMINISTRATOR)
export class OrganizationEntitiesController {
  constructor(private readonly entities: OrganizationEntitiesService) {}

  @Get()
  @ApiOperation({
    summary: 'The organization’s reporting entities',
    description:
      'Task 175. Each entity’s name, IDNO and whether it is archived — master data, never report content. ' +
      'Recorded in the support access log before it runs.',
  })
  @ApiParam({ name: ORGANIZATION_ID, format: 'uuid' })
  @ApiListResponse(OrganizationEntityResponseDto, {
    status: 200,
    description: 'Every reporting entity, the active ones first, each group by name.',
  })
  @ApiResponse({
    status: 401,
    description:
      'No usable operator session (problem type authentication-required), or its lifetimes ran out ' +
      '(problem type session-expired).',
    content: PROBLEM,
  })
  @ApiResponse({
    status: 403,
    description: 'The operator’s role is not platform_administrator (problem type insufficient-role).',
    content: PROBLEM,
  })
  @ApiResponse({
    status: 404,
    description: 'No organization in the register holds this id (problem type not-found).',
    content: PROBLEM,
  })
  async list(
    @Param(ORGANIZATION_ID, ParseUUIDPipe) organizationId: string,
  ): Promise<OrganizationEntityResponseDto[]> {
    const entities = await this.entities.entities({ organizationId });
    return entities.map((entity) => new OrganizationEntityResponseDto(entity));
  }
}
