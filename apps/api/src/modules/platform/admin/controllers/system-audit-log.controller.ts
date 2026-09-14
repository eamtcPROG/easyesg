import { Controller, Get, Query, Req, UseInterceptors } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { ApiListResponse } from '@api/app/decorators/api-envelope.decorator';
import { DEFAULT_ON_PAGE, MAX_ON_PAGE_ADMIN } from '@api/app/constants/pagination.constants';
import { RequestListDto } from '@api/app/dto/request-list.dto';
import { ResultListDto } from '@api/app/dto/result-list.dto';
import { ListQueryInterceptor } from '@api/app/interceptors/list-query.interceptor';
import { AUDIT_ACTION } from '@api/modules/platform/audit/models/audit-action.model';
import { RequiresAdminRole } from '../decorators/requires-admin-role.decorator';
import { SystemAuditLogEntryResponseDto } from '../dto/system-audit-log-entry.response.dto';
import { ADMIN_ROLE } from '../models/admin-session.model';
import { SystemAuditLogService } from '../services/system-audit-log.service';

const PROBLEM = { 'application/problem+json': {} };

/**
 * `/api/v1/admin/audit-log` — A-08's log (task 67.4; UC-88, FR-81): the platform's own events, newest
 * first. **Read through `esg_admin_ro`, and that read is itself logged** in the support access log
 * (§7.6), because a platform row is visible to no other role.
 *
 * **Its filters are their own query parameters**, not compact facets: an instant and a dotted action
 * would each need escaping around the compact grammar, and a value this route does not understand is
 * dropped rather than refused, so a stale address shows the log rather than an error.
 */
@ApiTags('platform')
@Controller('admin/audit-log')
@RequiresAdminRole(ADMIN_ROLE.PLATFORM_ADMINISTRATOR)
export class SystemAuditLogController {
  constructor(private readonly log: SystemAuditLogService) {}

  @Get()
  // An instance, not the class — `AccessController` records what passing the class costs.
  @UseInterceptors(new ListQueryInterceptor(false, MAX_ON_PAGE_ADMIN))
  @ApiOperation({
    summary: 'Read the platform-wide system audit log',
    description:
      'UC-88. Administrator account changes and every admin sign-in attempt, attributed and ' +
      'timestamped, newest first. Read-only: nothing in the console edits an entry.',
  })
  @ApiQuery({ name: 'operator', required: false, description: 'Only what this operator account did (uuid).' })
  @ApiQuery({
    name: 'action',
    required: false,
    enum: Object.values(AUDIT_ACTION),
    description: 'Only this kind of event.',
  })
  @ApiQuery({
    name: 'from',
    required: false,
    type: Number,
    description: 'Unix epoch milliseconds; only events at or after it.',
  })
  @ApiQuery({
    name: 'to',
    required: false,
    type: Number,
    description: 'Unix epoch milliseconds; only events before it.',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, description: '1-based.' })
  @ApiQuery({
    name: 'onpage',
    required: false,
    type: Number,
    description: `Entries per page, ${DEFAULT_ON_PAGE} unless given, at most ${MAX_ON_PAGE_ADMIN}. \`-1\` is refused.`,
  })
  @ApiListResponse(SystemAuditLogEntryResponseDto, {
    status: 200,
    description:
      'One page. `total` counts entries the filters admitted and is what pages are counted from; ' +
      '`unfiltered` counts every entry, which tells an empty page whether nothing has happened yet ' +
      'or nothing matched.',
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
  async list(
    @Req() request: Request,
    @Query('operator') operator?: unknown,
    @Query('action') action?: unknown,
    @Query('from') from?: unknown,
    @Query('to') to?: unknown,
  ): Promise<ResultListDto<SystemAuditLogEntryResponseDto>> {
    const query = this.log.narrow({
      list: request.requestList ?? new RequestListDto(),
      operator,
      action,
      from,
      to,
    });
    const page = await this.log.list(query);

    return new ResultListDto({
      objects: page.entries.map((entry) => new SystemAuditLogEntryResponseDto(entry)),
      total: page.matched,
      totalpages: Math.max(1, Math.ceil(page.matched / query.take)),
      unfiltered: page.total,
    });
  }
}
