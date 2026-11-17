import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiObjectResponse } from '@api/app/decorators/api-envelope.decorator';
import { NO_SUCH_REPORT } from '@api/modules/core/disclosure/errors/report.errors';
import { RequiresRole } from '@api/modules/identity/membership/decorators/requires-role.decorator';
import { MEMBERSHIP_ROLE } from '@api/modules/identity/membership/models/membership.model';
import { StepPageDto } from '../dto/step-page.dto';
import { StepPageService } from '../services/step-page.service';

/**
 * `GET /reports/{id}/steps/{module}` — S-07's step in one read (task 244). The routes it composes stay: each is
 * still what another screen, an export or a suite reads, and this one is what the wizard reads.
 */
@ApiTags('report')
@Controller('reports')
export class StepPageController {
  constructor(private readonly pages: StepPageService) {}

  @Get(':id/steps/:module')
  @RequiresRole(MEMBERSHIP_ROLE.EDITOR, MEMBERSHIP_ROLE.ORGANIZATION_ADMINISTRATOR, MEMBERSHIP_ROLE.VIEWER)
  @ApiOperation({
    summary: 'One wizard step with everything the step screen reads beside it',
    description:
      'The step, the module list, the report, the prior period’s answers for the step’s own elements, what the last ' +
      'validation run found and the rules answers are checked against — each as its own route answers it, read in ' +
      'one transaction so the parts cannot disagree, and the report and its answers read once for all of them.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiParam({ name: 'module', example: 'B8' })
  @ApiObjectResponse(StepPageDto, { status: 200, description: 'The step and what is read beside it.' })
  @ApiResponse({
    status: 404,
    description: `${NO_SUCH_REPORT} Also a module the report's pinned taxonomy version does not carry.`,
  })
  @ApiResponse({
    status: 409,
    description: 'A Comprehensive module on a report whose scope is Basic (FR-177): it is not served until the scope asks it.',
  })
  async page(@Param('id', ParseUUIDPipe) reportId: string, @Param('module') module: string): Promise<StepPageDto> {
    return new StepPageDto(await this.pages.page({ reportId, module }));
  }
}
