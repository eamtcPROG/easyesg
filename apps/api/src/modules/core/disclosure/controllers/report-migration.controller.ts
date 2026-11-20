import { Controller, Get, HttpCode, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiObjectResponse } from '@api/app/decorators/api-envelope.decorator';
import { RequiresRole } from '@api/modules/identity/membership/decorators/requires-role.decorator';
import { MEMBERSHIP_ROLE } from '@api/modules/identity/membership/models/membership.model';
import { MigrationReviewResponseDto } from '../dto/report-migration.dto';
import { ReportMigrationService } from '../services/report-migration.service';

const NOTHING_AWAITING = 'No migration of the report awaits a decision — none was held, or it was already decided (problem type not-found).';

/**
 * `/api/v1/reports/{id}/migration` — S-49, the organization's decision on a report a breaking taxonomy migration moved
 * (task 67.20; UC-78, UC-79; FR-69, FR-70; 182/43). **The Organization Administrator's alone**: the content is the
 * organization's, and the platform that ran the migration never sees a value (D-5).
 */
@ApiTags('report')
@Controller('reports')
@RequiresRole(MEMBERSHIP_ROLE.ORGANIZATION_ADMINISTRATOR)
export class ReportMigrationController {
  constructor(private readonly migrations: ReportMigrationService) {}

  @Get(':id/migration')
  @ApiOperation({
    summary: 'The report’s migration awaiting a decision',
    description: 'Task 67.20 (UC-79). The versions it moved between, when, and the fields the change touches, by label.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiObjectResponse(MigrationReviewResponseDto, { status: 200, description: 'The migration to decide on.' })
  @ApiResponse({ status: 404, description: NOTHING_AWAITING })
  async review(@Param('id', ParseUUIDPipe) reportId: string): Promise<MigrationReviewResponseDto> {
    return new MigrationReviewResponseDto(await this.migrations.review({ reportId }));
  }

  @Post(':id/migration/acceptance')
  @HttpCode(204)
  @ApiOperation({ summary: 'Keep the report on the new version', description: 'Task 67.20 (UC-79; 182/43).' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 204, description: 'Accepted.' })
  @ApiResponse({ status: 404, description: NOTHING_AWAITING })
  async accept(@Param('id', ParseUUIDPipe) reportId: string): Promise<void> {
    await this.migrations.accept({ reportId });
  }

  @Post(':id/migration/decline')
  @HttpCode(204)
  @ApiOperation({
    summary: 'Put the report back as it was before the migration',
    description: 'Task 67.20 (UC-79; FR-69; 182/41). Its answers, inputs and version restored; anything written since the move goes with it.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 204, description: 'Declined; the report is as it was.' })
  @ApiResponse({ status: 404, description: NOTHING_AWAITING })
  @ApiResponse({ status: 409, description: 'The report’s period was locked since the move (problem type report-not-editable).' })
  async decline(@Param('id', ParseUUIDPipe) reportId: string): Promise<void> {
    await this.migrations.decline({ reportId });
  }
}
