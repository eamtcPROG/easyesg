import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiListResponse, ApiObjectResponse } from '@api/app/decorators/api-envelope.decorator';
import { RequiresRole } from '@api/modules/identity/membership/decorators/requires-role.decorator';
import { MEMBERSHIP_ROLE } from '@api/modules/identity/membership/models/membership.model';
import {
  CreateReportRequestDto,
  ReportResponseDto,
  UpdateReportRequestDto,
} from '../dto/report.dto';
import { NO_SUCH_REPORT } from '../errors/report.errors';
import { ReportService } from '../services/report.service';

/**
 * `/api/v1/reports` — S-06's index and the report record (UC-17, UC-18; FR-24 … FR-32, FR-66,
 * FR-177).
 *
 * **The writes admit the editor, which is the opposite of the split `PeriodsController` carries**
 * (§12.5.6's task-31.3 row). A period and an entity are master data, which D-2 makes Organization
 * Administrator-owned; the report is the Contributor's own workspace — UC-18's actor is the RC and
 * FR-26 grants the editable session on *edit rights* rather than on a role. A create route the
 * Contributor could not reach would mean the person who authors the report cannot start it.
 *
 * **Reads are open to every member**, because FR-25 requires a view-only member to see "the same
 * entries without edit affordances", which needs the entries.
 *
 * **No `DELETE`.** Nothing in UC-17 or UC-18 removes a report, and a report against a period that
 * has been reported on is the record of a filing — FR-22 locks it. The route does not exist rather
 * than existing and refusing.
 *
 * **No route names a version, on any method.** DR-4 pins at creation from the period, and FR-69
 * moves a pin by an explicit migration run — so a field for one would make "never moves silently" a
 * convention. The database agrees: `esg_app` holds no `UPDATE` privilege on either column.
 *
 * **Recorded deferral: no entitlement gate until task 54.** `basic_and_comprehensive` is the paid
 * scope (`problem_overview.md` §6.1 row 15) and nothing here checks a plan for it; `apps/api
 * /CLAUDE.md` requires the key or the reason, and this is the reason.
 */
@ApiTags('report')
@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportService) {}

  @Get()
  @RequiresRole(
    MEMBERSHIP_ROLE.ORGANIZATION_ADMINISTRATOR,
    MEMBERSHIP_ROLE.EDITOR,
    MEMBERSHIP_ROLE.VIEWER,
  )
  @ApiOperation({
    summary: 'List the reports in the active organization, newest reporting period first (UC-17)',
    description:
      'Organization-wide by default, which is what FR-23’s overview reads. Narrowed to one entity ' +
      'by query parameter — the active organization comes from the session, never from a parameter.',
  })
  @ApiQuery({ name: 'reportingEntityId', required: false, format: 'uuid' })
  @ApiListResponse(ReportResponseDto, { status: 200, description: 'The reports.' })
  async list(
    @Query('reportingEntityId', new ParseUUIDPipe({ optional: true }))
    reportingEntityId?: string,
  ): Promise<ReportResponseDto[]> {
    const reports = await this.reports.list({ reportingEntityId });
    return reports.map((report) => new ReportResponseDto(report));
  }

  @Get(':id')
  @RequiresRole(
    MEMBERSHIP_ROLE.ORGANIZATION_ADMINISTRATOR,
    MEMBERSHIP_ROLE.EDITOR,
    MEMBERSHIP_ROLE.VIEWER,
  )
  @ApiOperation({ summary: 'One report, with its pinned versions' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiObjectResponse(ReportResponseDto, { status: 200, description: 'The report.' })
  @ApiResponse({ status: 404, description: NO_SUCH_REPORT })
  async view(@Param('id', ParseUUIDPipe) id: string): Promise<ReportResponseDto> {
    return new ReportResponseDto(await this.reports.view(id));
  }

  @Post()
  @RequiresRole(MEMBERSHIP_ROLE.ORGANIZATION_ADMINISTRATOR, MEMBERSHIP_ROLE.EDITOR)
  @ApiOperation({
    summary: 'Create the report for a reporting period (UC-18)',
    description:
      'The template and taxonomy versions are copied from the period, which pinned them when it ' +
      'was opened (FR-66, DR-4) — neither is a field on this request, deliberately. A period ' +
      'carries at most one report.',
  })
  @ApiObjectResponse(ReportResponseDto, { status: 201, description: 'The report created.' })
  @ApiResponse({ status: 404, description: 'No such reporting period in the active organization.' })
  @ApiResponse({
    status: 409,
    description: 'The period already has a report, or the period is locked.',
  })
  async create(@Body() body: CreateReportRequestDto): Promise<ReportResponseDto> {
    // Passed through as it arrived, absent field included: the default is a statement about the
    // scope vocabulary and is applied where that vocabulary's rules live, not at the transport edge.
    const report = await this.reports.create({
      reportingPeriodId: body.reportingPeriodId,
      scope: body.scope,
    });
    return new ReportResponseDto(report);
  }

  @Patch(':id')
  @RequiresRole(MEMBERSHIP_ROLE.ORGANIZATION_ADMINISTRATOR, MEMBERSHIP_ROLE.EDITOR)
  @ApiOperation({
    summary: 'Change the report’s module scope (FR-177)',
    description:
      'Comprehensive may be added to a report already in progress. The pinned versions are not ' +
      'editable: DR-4 moves them only by an explicit migration run (FR-69), so no field on this ' +
      'request can name one and the application role holds no privilege to write one.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiObjectResponse(ReportResponseDto, { status: 200, description: 'The report as it now stands.' })
  @ApiResponse({ status: 404, description: NO_SUCH_REPORT })
  @ApiResponse({ status: 409, description: 'The reporting period is locked.' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateReportRequestDto,
  ): Promise<ReportResponseDto> {
    return new ReportResponseDto(await this.reports.update({ reportId: id, patch: body }));
  }
}
