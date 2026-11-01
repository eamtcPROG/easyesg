import { Body, Controller, Delete, Param, ParseUUIDPipe, Put } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiObjectResponse } from '@api/app/decorators/api-envelope.decorator';
import { RequiresRole } from '@api/modules/identity/membership/decorators/requires-role.decorator';
import { MEMBERSHIP_ROLE } from '@api/modules/identity/membership/models/membership.model';
import { ReportResponseDto } from '../dto/report.dto';
import { MarkReportFiledRequestDto } from '../dto/report-filing-request.dto';
import { NO_SUCH_REPORT } from '../errors/report.errors';
import { ReportService } from '../services/report.service';

/**
 * `PUT`/`DELETE /api/v1/reports/:id/filing` — FR-41's *Mark as filed* on S-11, and its withdrawal (task 47.5;
 * §12.5.6's task-47 row (1)–(4)). **A resource of its own**: the mark is the reporter's statement about the report,
 * not an edit of it, and it is made on a locked report as on an open one.
 *
 * An editor or the Organization Administrator marks and withdraws (182/19); a view-only member is refused. Both answer
 * the report as it now stands, so S-11 re-renders from what the server holds.
 */
@ApiTags('report')
@Controller('reports')
export class ReportFilingController {
  constructor(private readonly reports: ReportService) {}

  @Put(':id/filing')
  @RequiresRole(MEMBERSHIP_ROLE.ORGANIZATION_ADMINISTRATOR, MEMBERSHIP_ROLE.EDITOR)
  @ApiOperation({
    summary: 'Mark the report filed (FR-41)',
    description:
      'Records that the report has left the building, on the day stated, and who recorded it. Allowed once an export ' +
      'of the report has completed; unresolved findings do not prevent it. A locked report is marked like an open one. ' +
      'Marking again replaces the day.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiObjectResponse(ReportResponseDto, { status: 200, description: 'The report, marked filed.' })
  @ApiResponse({ status: 400, description: 'The day is not a real calendar day.' })
  @ApiResponse({ status: 404, description: NO_SUCH_REPORT })
  @ApiResponse({ status: 409, description: 'No export of the report has completed yet.' })
  async mark(@Param('id', ParseUUIDPipe) id: string, @Body() body: MarkReportFiledRequestDto): Promise<ReportResponseDto> {
    return new ReportResponseDto(await this.reports.markFiled({ reportId: id, filedOn: body.filedOn }), this.reports.adopted());
  }

  @Delete(':id/filing')
  @RequiresRole(MEMBERSHIP_ROLE.ORGANIZATION_ADMINISTRATOR, MEMBERSHIP_ROLE.EDITOR)
  @ApiOperation({
    summary: 'Withdraw the filed mark (FR-41)',
    description: 'Clears the mark, and who and when with it; the change trail keeps both acts. No reason is asked.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiObjectResponse(ReportResponseDto, { status: 200, description: 'The report as it now stands.' })
  @ApiResponse({ status: 404, description: NO_SUCH_REPORT })
  async withdraw(@Param('id', ParseUUIDPipe) id: string): Promise<ReportResponseDto> {
    return new ReportResponseDto(await this.reports.withdrawFiling({ reportId: id }), this.reports.adopted());
  }
}
