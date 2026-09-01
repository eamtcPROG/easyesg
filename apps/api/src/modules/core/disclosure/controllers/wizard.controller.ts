import { Body, Controller, Get, Param, ParseUUIDPipe, Put } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiListResponse, ApiObjectResponse } from '@api/app/decorators/api-envelope.decorator';
import { RequiresRole } from '@api/modules/identity/membership/decorators/requires-role.decorator';
import { MEMBERSHIP_ROLE } from '@api/modules/identity/membership/models/membership.model';
import {
  DisclosureModuleSummaryDto,
  DisclosureStepDto,
  DisclosureValueResponseDto,
  WriteDisclosureValuesRequestDto,
} from '../dto/wizard-step.dto';
import { NO_SUCH_REPORT } from '../errors/report.errors';
import { WizardService } from '../services/wizard.service';

/**
 * `/api/v1/reports/:id/{modules,values}` — what S-07 reads and what its autosave writes (task 89).
 *
 * **Its own controller at the `reports` prefix**, on the precedent `InvitationsController` and
 * `InvitationBearerController` set (task 26.2) and `ComparativesController` followed: the URLs belong
 * to the report resource, and folding three wizard routes into `ReportsController` would put the
 * whole of FR-24 … FR-32's authoring surface beside four lines of report CRUD.
 *
 * **Two reads at different cadences, not one.** S-07's module list is persistent across every step
 * (UX-5) while a step's fields change with each; one route serving both would refetch 143 fields to
 * move the nav, and a wizard that refetches the whole taxonomy per step is the shape NFR-38's
 * autosave budget cannot afford.
 *
 * **Reads admit every member and the write admits the editor**, matching `ReportsController`'s own
 * split for its stated reason: FR-25 gives a view-only member the same entries, and FR-26 grants the
 * editable session on edit rights rather than on a role.
 *
 * **Recorded deferral: no entitlement gate until task 54**, like its neighbours.
 */
@ApiTags('report')
@Controller('reports')
export class WizardController {
  constructor(private readonly wizard: WizardService) {}

  @Get(':id/modules')
  @RequiresRole(
    MEMBERSHIP_ROLE.EDITOR,
    MEMBERSHIP_ROLE.ORGANIZATION_ADMINISTRATOR,
    MEMBERSHIP_ROLE.VIEWER,
  )
  @ApiOperation({
    summary: "The report's modules, with how much of each is answered",
    description:
      "S-07's persistent module list (UX-5). Resolved from the report's OWN pinned taxonomy " +
      'version, never the newest registered (DR-4).',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiListResponse(DisclosureModuleSummaryDto, {
    status: 200,
    description: "The modules the pinned version carries, in the standard's order.",
  })
  @ApiResponse({ status: 404, description: NO_SUCH_REPORT })
  async modules(@Param('id', ParseUUIDPipe) reportId: string): Promise<DisclosureModuleSummaryDto[]> {
    const summaries = await this.wizard.modules({ reportId });
    return summaries.map((summary) => new DisclosureModuleSummaryDto(summary));
  }

  @Get(':id/modules/:module')
  @RequiresRole(
    MEMBERSHIP_ROLE.EDITOR,
    MEMBERSHIP_ROLE.ORGANIZATION_ADMINISTRATOR,
    MEMBERSHIP_ROLE.VIEWER,
  )
  @ApiOperation({
    summary: 'One wizard step: the module\'s fields, with their values',
    description:
      'Taxonomy shape, resolved label with its standing (NFR-24), and the stored value, joined ' +
      'server-side because only this tier holds all three.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiParam({ name: 'module', example: 'B8' })
  @ApiObjectResponse(DisclosureStepDto, { status: 200, description: 'The step.' })
  @ApiResponse({ status: 404, description: NO_SUCH_REPORT })
  async step(
    @Param('id', ParseUUIDPipe) reportId: string,
    @Param('module') module: string,
  ): Promise<DisclosureStepDto> {
    return new DisclosureStepDto(await this.wizard.step({ reportId, module }));
  }

  @Put(':id/values')
  @RequiresRole(MEMBERSHIP_ROLE.EDITOR, MEMBERSHIP_ROLE.ORGANIZATION_ADMINISTRATOR)
  @ApiOperation({
    summary: 'Persist one or more field values (autosave)',
    description:
      'FR-37 persists on blur or step change, so this takes one value or a queue flush. An upsert ' +
      'on the natural key, so FR-38\'s retry writes the same row rather than a second one. Refused ' +
      "while the report's period is locked (FR-22), by the database as well as by the use case.",
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiListResponse(DisclosureValueResponseDto, {
    status: 200,
    description: 'What was durably committed — UX-36 acknowledges the commit, not local state.',
  })
  @ApiResponse({ status: 400, description: 'A field the pinned version does not name.' })
  @ApiResponse({ status: 404, description: NO_SUCH_REPORT })
  @ApiResponse({ status: 409, description: 'The reporting period is locked (FR-22).' })
  async write(
    @Param('id', ParseUUIDPipe) reportId: string,
    @Body() body: WriteDisclosureValuesRequestDto,
  ): Promise<DisclosureValueResponseDto[]> {
    const written = await this.wizard.write({
      reportId,
      values: body.values.map((value) => ({
        elementKey: value.elementKey,
        dimensionKey: value.dimensionKey ?? '',
        ordinal: value.ordinal ?? 0,
        contents: {
          valueNumeric: value.valueNumeric ?? null,
          valueText: value.valueText ?? null,
          valueBoolean: value.valueBoolean ?? null,
          valueDate: value.valueDate ?? null,
          unitCode: value.unitCode ?? null,
          state: value.state,
          notAvailableReason: value.notAvailableReason ?? null,
          carriedForward: value.carriedForward ?? false,
        },
      })),
    });
    return written.map((value) => new DisclosureValueResponseDto(value));
  }
}
