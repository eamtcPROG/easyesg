import { Controller, Get, Param, ParseUUIDPipe, Query, Req, UseInterceptors } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { ApiListResponse, ApiObjectResponse } from '@api/app/decorators/api-envelope.decorator';
import { DEFAULT_ON_PAGE, MAX_ON_PAGE_ADMIN } from '@api/app/constants/pagination.constants';
import { RequestListDto } from '@api/app/dto/request-list.dto';
import { ResultListDto } from '@api/app/dto/result-list.dto';
import { ListQueryInterceptor } from '@api/app/interceptors/list-query.interceptor';
import { RequiresAdminRole } from '../decorators/requires-admin-role.decorator';
import { OrganizationRegisterRowResponseDto } from '../dto/organization-register-row.response.dto';
import { ADMIN_ROLE } from '../models/admin-session.model';
import { OrganizationRegisterService } from '../services/organization-register.service';

const PROBLEM_MEDIA_TYPE = 'application/problem+json';

/**
 * `/api/v1/admin/organizations` — A-02's register (UC-69, FR-76; task 67.3), the admin realm's first
 * route beyond its handshake and the first reached through `AdminRealmGuard`.
 *
 * **A Platform Administrator's, and a Billing Operator's refusal is the point of the guard**:
 * actors.md §5 gives the register to PA alone, and PA holds no billing authority any more than BO
 * holds this. The console hides the destination from a BO too, and that is presentation; this
 * decorator is what refuses one who types the address.
 *
 * **Read across every organization through `esg_admin_ro`, logged before it reads** (§7.6) — see
 * `admin-readonly.ts`. **Account-level metadata only** (FR-77, D-5): the columns are the
 * `OrganizationRegisterRowResponseDto`'s, and nothing about what a report holds is among them.
 *
 * **Not bounded**: `onpage=-1` is refused, and a page is clamped to the admin ceiling. Two thousand
 * organizations is the §1 envelope, and a route that can be asked for all of them is one a larger
 * platform turns into a slow page with nobody editing it.
 */
@ApiTags('platform')
@Controller('admin/organizations')
@RequiresAdminRole(ADMIN_ROLE.PLATFORM_ADMINISTRATOR)
export class OrganizationRegisterController {
  constructor(private readonly register: OrganizationRegisterService) {}

  @Get()
  // An instance, not the class — `AccessController` records what passing the class costs.
  @UseInterceptors(new ListQueryInterceptor(false, MAX_ON_PAGE_ADMIN))
  @ApiOperation({
    summary: 'Search the register of every organization on the platform',
    description:
      'UC-69. Account-level metadata for every registered organization — name, IDNO, ' +
      'registration date, active entity count, report count and the most recent member sign-in — ' +
      'and never report content. Every read is recorded in the support access log before it runs.',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    description:
      'Matched against the organization’s name anywhere in it, case-insensitively, and against its ' +
      'IDNO as a prefix. Its own parameter rather than a filter, because a name may contain the ' +
      'filter grammar’s separators. Trimmed; blank means no search.',
  })
  @ApiQuery({
    name: 'order',
    required: false,
    description:
      'One ordering: `<name|registered|entities|reports|activity>,<asc|desc>`. Defaults to ' +
      '`name,asc`. An ordering this route does not offer falls back to the default.',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, description: '1-based.' })
  @ApiQuery({
    name: 'onpage',
    required: false,
    type: Number,
    description: `Rows per page, ${DEFAULT_ON_PAGE} unless given, at most ${MAX_ON_PAGE_ADMIN}. \`-1\` is refused.`,
  })
  @ApiListResponse(OrganizationRegisterRowResponseDto, {
    status: 200,
    description:
      'One page of the register. `total` counts organizations the search admitted and is what ' +
      'pages are counted from; `unfiltered` counts every organization, which is what tells an ' +
      'empty result whether nothing has registered or nothing matched.',
  })
  @ApiResponse({
    status: 401,
    description:
      'No usable operator session (problem type authentication-required), or its lifetimes ran ' +
      'out (problem type session-expired).',
    content: { [PROBLEM_MEDIA_TYPE]: {} },
  })
  @ApiResponse({
    status: 403,
    description:
      'The operator’s role is not platform_administrator (problem type insufficient-role).',
    content: { [PROBLEM_MEDIA_TYPE]: {} },
  })
  async list(
    @Req() request: Request,
    @Query('search') search?: unknown,
  ): Promise<ResultListDto<OrganizationRegisterRowResponseDto>> {
    const query = this.register.narrow({ list: request.requestList ?? new RequestListDto(), search });
    const page = await this.register.list(query);

    return new ResultListDto({
      objects: page.rows.map((row) => new OrganizationRegisterRowResponseDto(row)),
      total: page.matched,
      totalpages: Math.max(1, Math.ceil(page.matched / query.take)),
      unfiltered: page.total,
    });
  }

  @Get(':organizationId')
  @ApiOperation({
    summary: 'One organization’s register row',
    description:
      'Task 67.9. The row the register lists for this organization — account-level metadata, never ' +
      'report content — which the support-access request form names the organization with. Recorded in ' +
      'the support access log before it runs, naming the organization read.',
  })
  @ApiParam({ name: 'organizationId', format: 'uuid' })
  @ApiObjectResponse(OrganizationRegisterRowResponseDto, { status: 200, description: 'The organization’s row.' })
  @ApiResponse({
    status: 401,
    description:
      'No usable operator session (problem type authentication-required), or its lifetimes ran ' +
      'out (problem type session-expired).',
    content: { [PROBLEM_MEDIA_TYPE]: {} },
  })
  @ApiResponse({
    status: 403,
    description:
      'The operator’s role is not platform_administrator (problem type insufficient-role).',
    content: { [PROBLEM_MEDIA_TYPE]: {} },
  })
  @ApiResponse({
    status: 404,
    description: 'No organization in the register holds this id (problem type not-found).',
    content: { [PROBLEM_MEDIA_TYPE]: {} },
  })
  async row(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
  ): Promise<OrganizationRegisterRowResponseDto> {
    return new OrganizationRegisterRowResponseDto(await this.register.row(organizationId));
  }
}
