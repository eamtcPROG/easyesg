import { Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiObjectResponse } from '@api/app/decorators/api-envelope.decorator';
import { NO_SUCH_REPORT } from '@api/modules/core/disclosure/errors/report.errors';
import { RequiresRole } from '@api/modules/identity/membership/decorators/requires-role.decorator';
import { MEMBERSHIP_ROLE } from '@api/modules/identity/membership/models/membership.model';
import { ValidationDto, ValidationRulesDto } from '../dto/validation.dto';
import { ValidationService } from '../services/validation.service';

const RULES_UNAVAILABLE =
  'No validation rule set can be read right now (problem type validation-rules-unavailable), so nothing was checked ' +
  'and nothing changed. Try again shortly.';

const RULES_UNAVAILABLE_TO_READ =
  'No validation rule set can be read right now (problem type validation-rules-unavailable), so there is nothing to ' +
  'check answers against. Try again shortly.';

/**
 * `/api/v1/reports/:id/validation…` — UC-40: *check my report*, and what the last check found (task 41.2; FR-40,
 * FR-43; S-08).
 *
 * **At the `reports` prefix**, the calculator's precedent: a report's validation belongs to the report resource.
 * **The read admits every member and the run an editor or the OA** (182/22): a view-only member reads the findings and
 * is refused a run.
 *
 * **A run is a `POST` of a resource that replaces the last** (FR-43): it answers `201` with what it found, the same body
 * the read answers. **It writes on a locked period** (182/21), which is why it carries no locked refusal.
 *
 * **The rules are a read every member makes** (task 42.1): evaluating inline is reading the report, which a view-only
 * member does as an editor does (182/22), and it changes nothing.
 *
 * **Recorded deferral: no entitlement gate until task 54**, like its neighbours.
 */
@ApiTags('validation')
@Controller('reports')
export class ValidationController {
  constructor(private readonly validation: ValidationService) {}

  @Get(':id/validation')
  @RequiresRole(MEMBERSHIP_ROLE.EDITOR, MEMBERSHIP_ROLE.ORGANIZATION_ADMINISTRATOR, MEMBERSHIP_ROLE.VIEWER)
  @ApiOperation({
    summary: 'What the last validation run found',
    description:
      'The last run and its findings, in rule order, as the run left them — except that a finding whose field no ' +
      'longer applies, or whose section or module has since been declared omitted, is not returned (FR-43, 182/26). ' +
      'Nothing is evaluated: a report edited since its last run reads as that run left it.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiObjectResponse(ValidationDto, { status: 200, description: 'The last run, or none, and its findings.' })
  @ApiResponse({ status: 404, description: NO_SUCH_REPORT })
  async read(@Param('id', ParseUUIDPipe) reportId: string): Promise<ValidationDto> {
    return new ValidationDto(await this.validation.read({ reportId }));
  }

  @Get(':id/validation/rules')
  @RequiresRole(MEMBERSHIP_ROLE.EDITOR, MEMBERSHIP_ROLE.ORGANIZATION_ADMINISTRATOR, MEMBERSHIP_ROLE.VIEWER)
  @ApiOperation({
    summary: 'The rules the report is checked against',
    description:
      'The rule set a run would read now — in force today in the period’s zone, or the one its lock pinned — and the ' +
      'elements of the report’s scope, so a client evaluates its answers with the same interpreter and the same rules ' +
      'the run does (FR-40, OQ-49). Nothing is evaluated or stored.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiObjectResponse(ValidationRulesDto, { status: 200, description: 'The rules, and the scope they read.' })
  @ApiResponse({ status: 404, description: NO_SUCH_REPORT })
  @ApiResponse({ status: 503, description: RULES_UNAVAILABLE_TO_READ })
  async rules(@Param('id', ParseUUIDPipe) reportId: string): Promise<ValidationRulesDto> {
    return new ValidationRulesDto(await this.validation.rules({ reportId }));
  }

  @Post(':id/validation/runs')
  @RequiresRole(MEMBERSHIP_ROLE.EDITOR, MEMBERSHIP_ROLE.ORGANIZATION_ADMINISTRATOR)
  @ApiOperation({
    summary: 'Run validation',
    description:
      'Evaluates the report at whatever completeness it stands, against the rule set in force today — or, on a locked ' +
      'period, the one its lock pinned — and replaces the report’s findings with what it finds (FR-43, FR-73 item 9). ' +
      'Repeated over unchanged answers it finds the same. A locked report is validated like any other (182/21).',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiObjectResponse(ValidationDto, { status: 201, description: 'The run, and what it found.' })
  @ApiResponse({ status: 404, description: NO_SUCH_REPORT })
  @ApiResponse({ status: 503, description: RULES_UNAVAILABLE })
  async run(@Param('id', ParseUUIDPipe) reportId: string): Promise<ValidationDto> {
    return new ValidationDto(await this.validation.run({ reportId }));
  }
}
