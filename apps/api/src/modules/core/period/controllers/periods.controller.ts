import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiListResponse, ApiObjectResponse } from '@api/app/decorators/api-envelope.decorator';
import { RequiresRole } from '@api/modules/identity/membership/decorators/requires-role.decorator';
import { MEMBERSHIP_ROLE } from '@api/modules/identity/membership/models/membership.model';
import {
  OpenReportingPeriodRequestDto,
  ReportingPeriodResponseDto,
  UpdateReportingPeriodRequestDto,
} from '../dto/reporting-period.dto';
import { PeriodService } from '../services/period.service';

/**
 * `/api/v1/periods` — S-14's Index and Record (UC-56; FR-21, FR-45, FR-66).
 *
 * **Reads are open to every member; writes are Organization Administrator only.** UC-56 names the
 * OA as its primary actor, and the reason the reads are wider is `EntitiesController`'s: a
 * Contributor works *inside* a period and the wizard has to name which one, so refusing them the
 * read would make their own workspace unreachable. The gate is declared per method rather than at
 * the class so the split is visible where somebody would otherwise add a role without thinking.
 *
 * **No `DELETE`.** Nothing in UC-56 … UC-58 removes a period, and a period that has been reported
 * against is the record of a filing — FR-22 locks it, and 31.2's reopen is a recorded correction.
 * The route does not exist rather than existing and refusing.
 *
 * **Recorded deferral: no entitlement gate until task 54.** How many periods a plan admits is
 * unanswered; `apps/api/CLAUDE.md` requires the key or the reason, and this is the reason.
 */
@ApiTags('period')
@Controller('periods')
export class PeriodsController {
  constructor(private readonly periods: PeriodService) {}

  @Get()
  @RequiresRole(
    MEMBERSHIP_ROLE.ORGANIZATION_ADMINISTRATOR,
    MEMBERSHIP_ROLE.EDITOR,
    MEMBERSHIP_ROLE.VIEWER,
  )
  @ApiOperation({
    summary: 'List the reporting periods of one entity, newest first',
    description:
      'Scoped to one entity because a period only means anything against one (FR-21). The active ' +
      'organization comes from the session, never from a parameter.',
  })
  @ApiQuery({ name: 'reportingEntityId', required: true, format: 'uuid' })
  @ApiListResponse(ReportingPeriodResponseDto, { status: 200, description: 'The entity’s periods.' })
  async list(
    @Query('reportingEntityId', ParseUUIDPipe) reportingEntityId: string,
  ): Promise<ReportingPeriodResponseDto[]> {
    const periods = await this.periods.list({ reportingEntityId });
    return periods.map((period) => new ReportingPeriodResponseDto(period));
  }

  @Get(':id')
  @RequiresRole(
    MEMBERSHIP_ROLE.ORGANIZATION_ADMINISTRATOR,
    MEMBERSHIP_ROLE.EDITOR,
    MEMBERSHIP_ROLE.VIEWER,
  )
  @ApiOperation({ summary: 'One reporting period, with its pinned versions' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiObjectResponse(ReportingPeriodResponseDto, { status: 200, description: 'The period.' })
  @ApiResponse({ status: 404, description: 'No such period in the active organization.' })
  async view(@Param('id', ParseUUIDPipe) id: string): Promise<ReportingPeriodResponseDto> {
    return new ReportingPeriodResponseDto(await this.periods.view(id));
  }

  @Post()
  @RequiresRole(MEMBERSHIP_ROLE.ORGANIZATION_ADMINISTRATOR)
  @ApiOperation({
    summary: 'Open a reporting period (UC-56)',
    description:
      'The template and taxonomy versions are pinned by the system from the registered adoption ' +
      '(FR-66, DR-4) and the preceding period is linked automatically (FR-45) — neither is a ' +
      'field on this request, deliberately.',
  })
  @ApiObjectResponse(ReportingPeriodResponseDto, { status: 201, description: 'The period opened.' })
  @ApiResponse({ status: 400, description: 'The dates do not describe a period.' })
  @ApiResponse({ status: 404, description: 'No such entity in the active organization.' })
  @ApiResponse({
    status: 409,
    description:
      'The entity is archived, another period overlaps these dates, or no taxonomy version is ' +
      'registered to pin.',
  })
  async open(
    @Body() body: OpenReportingPeriodRequestDto,
  ): Promise<ReportingPeriodResponseDto> {
    const period = await this.periods.open({
      period: {
        reportingEntityId: body.reportingEntityId,
        fiscalYear: body.fiscalYear,
        periodStart: body.periodStart,
        periodEnd: body.periodEnd,
        dueDate: body.dueDate ?? null,
      },
    });
    return new ReportingPeriodResponseDto(period);
  }

  @Patch(':id')
  @RequiresRole(MEMBERSHIP_ROLE.ORGANIZATION_ADMINISTRATOR)
  @ApiOperation({
    summary: 'Edit the period shell',
    description:
      'The pinned versions are not editable: DR-4 moves them only by an explicit migration run ' +
      '(FR-69), so no field on this request can name one.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiObjectResponse(ReportingPeriodResponseDto, { status: 200, description: 'The period as it now stands.' })
  @ApiResponse({ status: 400, description: 'The dates do not describe a period.' })
  @ApiResponse({ status: 404, description: 'No such period in the active organization.' })
  @ApiResponse({ status: 409, description: 'Another period overlaps these dates.' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateReportingPeriodRequestDto,
  ): Promise<ReportingPeriodResponseDto> {
    return new ReportingPeriodResponseDto(await this.periods.update({ periodId: id, patch: body }));
  }
}
