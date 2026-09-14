import { Controller, Get, HttpCode, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiListResponse, ApiObjectResponse } from '@api/app/decorators/api-envelope.decorator';
import { AUDIT_TARGET, AuditAction } from '@api/app/decorators/audit-action.decorator';
import { NO_CONTENT_RESPONSE } from '@api/app/interceptors/global-response.interceptor';
import { ReportResponseDto } from '@api/modules/core/disclosure/dto/report.dto';
import { DisclosureModuleSummaryDto, DisclosureStepDto } from '@api/modules/core/disclosure/dto/wizard-step.dto';
import { RequiresAdminRole } from '@api/modules/platform/admin/decorators/requires-admin-role.decorator';
import { ADMIN_ROLE } from '@api/modules/platform/admin/models/admin-session.model';
import { AUDIT_ACTION } from '@api/modules/platform/audit/models/audit-action.model';
import { AdminSupportAccessService } from '../services/admin-support-access.service';
import { SupportAccessReportsService } from '../services/support-access-reports.service';

const PROBLEM = { 'application/problem+json': {} };
const ORGANIZATION_ID = 'organizationId';
const REQUEST_ID = 'requestId';

const SIGNED_OUT = {
  status: 401,
  description:
    'No usable operator session (problem type authentication-required), or its lifetimes ran out ' +
    '(problem type session-expired).',
  content: PROBLEM,
} as const;

const NOT_PLATFORM_ADMINISTRATOR = {
  status: 403,
  description: 'The operator’s role is not platform_administrator (problem type insufficient-role).',
  content: PROBLEM,
} as const;

const GRANT_CLOSED = {
  status: 403,
  description:
    'The request is not active for this operator — never granted, ended, expired, or another operator’s — so ' +
    'nothing was read (problem type support-access-required).',
  content: PROBLEM,
} as const;

/**
 * `/api/v1/admin/organizations/:organizationId/support-access/:requestId` — one grant (task 67.9; UC-85;
 * FR-77 … FR-79): ending it, and **the only reads by which a Platform Administrator reaches an organization's
 * report data**.
 *
 * **Every read is permitted by the grant, logged before it runs, and bound to the organization read-only**
 * (`ReadUnderSupportAccess`): the operator who asked, while the grant is running, sees the organization's reports
 * exactly as its members' reads see them, and nothing under a grant can write. **Any Platform Administrator may
 * end any running grant** (project owner, 14 Sep 2026); only the one who asked may read under it.
 */
@ApiTags('platform')
@Controller(`admin/organizations/:${ORGANIZATION_ID}/support-access/:${REQUEST_ID}`)
@RequiresAdminRole(ADMIN_ROLE.PLATFORM_ADMINISTRATOR)
export class SupportAccessGrantController {
  constructor(
    private readonly supportAccess: AdminSupportAccessService,
    private readonly reports: SupportAccessReportsService,
  ) {}

  @Post('end')
  @HttpCode(204)
  @AuditAction({ action: AUDIT_ACTION.ADMIN_SUPPORT_ACCESS_ENDED, target: { from: AUDIT_TARGET.PARAM, name: REQUEST_ID } })
  @ApiOperation({
    summary: 'End running support access before its 60 minutes',
    description:
      'UC-85. Any Platform Administrator may end any running grant; the organization sees it end. Recorded in ' +
      'the support access log and the system audit log.',
  })
  @ApiParam({ name: ORGANIZATION_ID, format: 'uuid' })
  @ApiParam({ name: REQUEST_ID, format: 'uuid' })
  @ApiResponse({ status: 204, description: 'Ended.' })
  @ApiResponse(SIGNED_OUT)
  @ApiResponse(NOT_PLATFORM_ADMINISTRATOR)
  @ApiResponse({
    status: 404,
    description: 'The organization has no such request (problem type not-found).',
    content: PROBLEM,
  })
  @ApiResponse({
    status: 409,
    description: 'The access is not running — never granted, ended already, or expired (problem type conflict).',
    content: PROBLEM,
  })
  async end(
    @Param(ORGANIZATION_ID, ParseUUIDPipe) organizationId: string,
    @Param(REQUEST_ID, ParseUUIDPipe) requestId: string,
  ): Promise<typeof NO_CONTENT_RESPONSE> {
    await this.supportAccess.end({ organizationId, requestId });
    return NO_CONTENT_RESPONSE;
  }

  @Get('reports')
  @ApiOperation({
    summary: 'The organization’s reports, under a running grant',
    description:
      'The reports the organization’s own report list shows, newest reporting period first — read-only, ' +
      'recorded in the support access log before the read runs.',
  })
  @ApiParam({ name: ORGANIZATION_ID, format: 'uuid' })
  @ApiParam({ name: REQUEST_ID, format: 'uuid' })
  @ApiListResponse(ReportResponseDto, { status: 200, description: 'The reports.' })
  @ApiResponse(SIGNED_OUT)
  @ApiResponse(NOT_PLATFORM_ADMINISTRATOR)
  @ApiResponse(GRANT_CLOSED)
  async listReports(
    @Param(ORGANIZATION_ID, ParseUUIDPipe) organizationId: string,
    @Param(REQUEST_ID, ParseUUIDPipe) requestId: string,
  ): Promise<ReportResponseDto[]> {
    const reports = await this.reports.list({ organizationId, requestId });
    return reports.map((report) => new ReportResponseDto(report));
  }

  @Get('reports/:reportId/modules')
  @ApiOperation({
    summary: 'One report’s modules, under a running grant',
    description:
      'The report’s modules with how much of each is answered, as the organization’s wizard shows them — ' +
      'read-only, recorded in the support access log before the read runs.',
  })
  @ApiParam({ name: ORGANIZATION_ID, format: 'uuid' })
  @ApiParam({ name: REQUEST_ID, format: 'uuid' })
  @ApiParam({ name: 'reportId', format: 'uuid' })
  @ApiListResponse(DisclosureModuleSummaryDto, { status: 200, description: 'The modules.' })
  @ApiResponse(SIGNED_OUT)
  @ApiResponse(NOT_PLATFORM_ADMINISTRATOR)
  @ApiResponse(GRANT_CLOSED)
  @ApiResponse({ status: 404, description: 'The organization has no such report (problem type not-found).', content: PROBLEM })
  async modules(
    @Param(ORGANIZATION_ID, ParseUUIDPipe) organizationId: string,
    @Param(REQUEST_ID, ParseUUIDPipe) requestId: string,
    @Param('reportId', ParseUUIDPipe) reportId: string,
  ): Promise<DisclosureModuleSummaryDto[]> {
    const summaries = await this.reports.modules({ organizationId, requestId, reportId });
    return summaries.map((summary) => new DisclosureModuleSummaryDto(summary));
  }

  @Get('reports/:reportId/modules/:module')
  @ApiOperation({
    summary: 'One module’s values, under a running grant',
    description:
      'The module’s fields with their values, as the organization’s wizard shows them — read-only, recorded ' +
      'in the support access log before the read runs.',
  })
  @ApiParam({ name: ORGANIZATION_ID, format: 'uuid' })
  @ApiParam({ name: REQUEST_ID, format: 'uuid' })
  @ApiParam({ name: 'reportId', format: 'uuid' })
  @ApiParam({ name: 'module', example: 'B3' })
  @ApiObjectResponse(DisclosureStepDto, { status: 200, description: 'The module.' })
  @ApiResponse(SIGNED_OUT)
  @ApiResponse(NOT_PLATFORM_ADMINISTRATOR)
  @ApiResponse(GRANT_CLOSED)
  @ApiResponse({
    status: 404,
    description: 'The organization has no such report, or its version has no such module (problem type not-found).',
    content: PROBLEM,
  })
  async step(
    @Param(ORGANIZATION_ID, ParseUUIDPipe) organizationId: string,
    @Param(REQUEST_ID, ParseUUIDPipe) requestId: string,
    @Param('reportId', ParseUUIDPipe) reportId: string,
    @Param('module') module: string,
  ): Promise<DisclosureStepDto> {
    return new DisclosureStepDto(await this.reports.step({ organizationId, requestId, reportId, module }));
  }
}
