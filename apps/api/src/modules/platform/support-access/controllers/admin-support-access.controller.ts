import { Body, Controller, Get, HttpCode, Post, Req, UseInterceptors } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { ApiListResponse, ApiObjectResponse } from '@api/app/decorators/api-envelope.decorator';
import { AUDIT_TARGET, AuditAction } from '@api/app/decorators/audit-action.decorator';
import { DEFAULT_ON_PAGE, MAX_ON_PAGE_ADMIN } from '@api/app/constants/pagination.constants';
import { RequestListDto } from '@api/app/dto/request-list.dto';
import { ResultListDto } from '@api/app/dto/result-list.dto';
import { ListQueryInterceptor } from '@api/app/interceptors/list-query.interceptor';
import { RequiresAdminRole } from '@api/modules/platform/admin/decorators/requires-admin-role.decorator';
import { ADMIN_ROLE } from '@api/modules/platform/admin/models/admin-session.model';
import { AUDIT_ACTION } from '@api/modules/platform/audit/models/audit-action.model';
import { RaiseSupportAccessRequestDto } from '../dto/raise-support-access.request.dto';
import { SupportAccessLogEntryResponseDto } from '../dto/support-access-log-entry.response.dto';
import { SupportAccessRaisedResponseDto } from '../dto/support-access-raised.response.dto';
import { AdminSupportAccessService } from '../services/admin-support-access.service';

const PROBLEM = { 'application/problem+json': {} };

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
    'The operator’s role is not platform_administrator (problem type insufficient-role), or a write came ' +
    'from an origin other than the console’s.',
  content: PROBLEM,
} as const;

/**
 * `/api/v1/admin/support-access` — A-07's log and its requests (task 67.9; UC-85, UC-86; FR-77 … FR-79).
 *
 * **A request asks and grants nothing.** The organization answers it, from its own application, and nobody here
 * can answer for it — the log's platform insert policy refuses a grant from this side outright. **The log is
 * every request by every operator**, read through `esg_admin_ro`, and that read is itself logged.
 */
@ApiTags('platform')
@Controller('admin/support-access')
@RequiresAdminRole(ADMIN_ROLE.PLATFORM_ADMINISTRATOR)
export class AdminSupportAccessController {
  constructor(private readonly supportAccess: AdminSupportAccessService) {}

  @Get()
  // An instance, not the class — `AccessController` records what passing the class costs.
  @UseInterceptors(new ListQueryInterceptor(false, MAX_ON_PAGE_ADMIN))
  @ApiOperation({
    summary: 'Read the support access log',
    description:
      'UC-86. Every support-access request, newest first: who asked, over which organization, for what ' +
      'reason, what the organization decided and who decided it, how it ended, and every read made under it. ' +
      'Read-only: nothing edits an entry. Reading it is recorded in the same log.',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, description: '1-based.' })
  @ApiQuery({
    name: 'onpage',
    required: false,
    type: Number,
    description: `Entries per page, ${DEFAULT_ON_PAGE} unless given, at most ${MAX_ON_PAGE_ADMIN}. \`-1\` is refused.`,
  })
  @ApiListResponse(SupportAccessLogEntryResponseDto, {
    status: 200,
    description: 'One page of the log. `total` counts every request ever raised.',
  })
  @ApiResponse(SIGNED_OUT)
  @ApiResponse(NOT_PLATFORM_ADMINISTRATOR)
  async list(@Req() request: Request): Promise<ResultListDto<SupportAccessLogEntryResponseDto>> {
    const window = this.supportAccess.window(request.requestList ?? new RequestListDto());
    const page = await this.supportAccess.list(window);

    return new ResultListDto({
      objects: page.entries.map((entry) => new SupportAccessLogEntryResponseDto(entry)),
      total: page.total,
      totalpages: Math.max(1, Math.ceil(page.total / window.take)),
    });
  }

  @Post()
  @HttpCode(201)
  @AuditAction({ action: AUDIT_ACTION.ADMIN_SUPPORT_ACCESS_REQUESTED, target: { from: AUDIT_TARGET.RESULT } })
  @ApiOperation({
    summary: 'Ask an organization for read-only support access',
    description:
      'UC-85. Raises a request with a ticket reference and a reason, which the organization’s administrators ' +
      'see and answer in their own application. Nothing is granted here: a grant lasts 60 minutes from when the ' +
      'organization gives it, and a request nobody answers lapses after 24 hours. Recorded in the system audit log.',
  })
  @ApiObjectResponse(SupportAccessRaisedResponseDto, {
    status: 201,
    description: 'The request, waiting for the organization.',
  })
  @ApiResponse({
    status: 400,
    description: 'The ticket reference or the reason is missing or too long (problem type validation-failed).',
    content: PROBLEM,
  })
  @ApiResponse(SIGNED_OUT)
  @ApiResponse(NOT_PLATFORM_ADMINISTRATOR)
  @ApiResponse({ status: 404, description: 'No organization has this id (problem type not-found).', content: PROBLEM })
  @ApiResponse({
    status: 409,
    description:
      'This operator already has a request with the organization that is waiting or running (problem type ' +
      'support-access-outstanding).',
    content: PROBLEM,
  })
  async raise(@Body() body: RaiseSupportAccessRequestDto): Promise<SupportAccessRaisedResponseDto> {
    return new SupportAccessRaisedResponseDto(await this.supportAccess.raise(body));
  }
}
