import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Put } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiListResponse, ApiObjectResponse } from '@api/app/decorators/api-envelope.decorator';
import { NO_SUCH_REPORT } from '@api/modules/core/disclosure/errors/report.errors';
import { NO_SUCH_RUN } from '../errors/calculator.errors';
import { RequiresRole } from '@api/modules/identity/membership/decorators/requires-role.decorator';
import { MEMBERSHIP_ROLE } from '@api/modules/identity/membership/models/membership.model';
import { CalcRunDto, CalcRunReplayDto } from '../dto/calc-run.dto';
import { ExplainFigureRequestDto, OverrideFigureRequestDto } from '../dto/calc-figure.dto';
import { CalcSourceDto, WriteCalcSourceRequestDto } from '../dto/calc-source.dto';
import { CalculatorService } from '../services/calculator.service';

const LOCKED = 'The reporting period is locked (FR-22).';

/**
 * `/api/v1/reports/:id/calculator/…` — S-09's invoice lines and the runs that retain them (task 38.1; UC-32, UC-33).
 *
 * **At the `reports` prefix**, `WizardController`'s precedent: a report's lines belong to the report resource. **Reads
 * admit every member and writes the editor**, the wizard's split for its stated reason (FR-25, FR-26).
 *
 * **A line is written whole, under an id its client chose** — `PUT`, so FR-38's replayed autosave writes the same line
 * again rather than a second one; `DELETE` answers `204` whether or not the line was there, for the same replay.
 *
 * **Recorded deferral: no entitlement gate until task 54**, like its neighbours.
 */
@ApiTags('calculator')
@Controller('reports')
export class CalculatorController {
  constructor(private readonly calculator: CalculatorService) {}

  @Get(':id/calculator/sources')
  @RequiresRole(MEMBERSHIP_ROLE.EDITOR, MEMBERSHIP_ROLE.ORGANIZATION_ADMINISTRATOR, MEMBERSHIP_ROLE.VIEWER)
  @ApiOperation({
    summary: "The report's invoice lines",
    description: 'Every line by source and site, in invoice units (FR-33), oldest first. They stay after a calculation.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiListResponse(CalcSourceDto, { status: 200, description: 'The lines, possibly none.' })
  @ApiResponse({ status: 404, description: NO_SUCH_REPORT })
  async sources(@Param('id', ParseUUIDPipe) reportId: string): Promise<CalcSourceDto[]> {
    const sources = await this.calculator.sources({ reportId });
    return sources.map((source) => new CalcSourceDto(source));
  }

  @Put(':id/calculator/sources/:sourceId')
  @RequiresRole(MEMBERSHIP_ROLE.EDITOR, MEMBERSHIP_ROLE.ORGANIZATION_ADMINISTRATOR)
  @ApiOperation({
    summary: 'Create or replace one invoice line',
    description:
      "By source and by one of the report's B1 sites, as a figure in an invoice unit or a reason there is none. The " +
      "source and unit are checked against the factor set the report's period resolves. Refused while the report's " +
      'period is locked (FR-22), by the database as well as by the use case.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiParam({ name: 'sourceId', format: 'uuid', description: 'Chosen by the client, so a retried write is the same line.' })
  @ApiObjectResponse(CalcSourceDto, { status: 200, description: 'The line as stored.' })
  @ApiResponse({ status: 400, description: 'A source, unit or site the report does not admit, or a malformed line.' })
  @ApiResponse({ status: 404, description: NO_SUCH_REPORT })
  @ApiResponse({ status: 409, description: `${LOCKED} Or no factor set serves the period, or the id is another report's.` })
  async write(
    @Param('id', ParseUUIDPipe) reportId: string,
    @Param('sourceId', ParseUUIDPipe) sourceId: string,
    @Body() body: WriteCalcSourceRequestDto,
  ): Promise<CalcSourceDto> {
    const written = await this.calculator.write({
      reportId,
      sourceId,
      siteOrdinal: body.siteOrdinal,
      sourceKey: body.sourceKey,
      description: body.description ?? null,
      contents: {
        quantity: body.quantity ?? null,
        unitCode: body.unitCode ?? null,
        notAvailableReason: body.notAvailableReason ?? null,
      },
      // Either half alone is an override missing its other half, which the use case refuses rather than drops.
      override:
        (body.overrideTonnes ?? null) === null && (body.overrideExplanation ?? null) === null
          ? null
          : { tonnesCo2e: body.overrideTonnes ?? '', explanation: body.overrideExplanation ?? '' },
    });
    return new CalcSourceDto(written);
  }

  @Delete(':id/calculator/sources/:sourceId')
  @RequiresRole(MEMBERSHIP_ROLE.EDITOR, MEMBERSHIP_ROLE.ORGANIZATION_ADMINISTRATOR)
  @ApiOperation({
    summary: 'Remove one invoice line',
    description: 'A run that already read it keeps its copy (P-11). Removing a line that is not there is not an error.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiParam({ name: 'sourceId', format: 'uuid' })
  @ApiResponse({ status: 204, description: 'The line is not in the report.' })
  @ApiResponse({ status: 404, description: NO_SUCH_REPORT })
  @ApiResponse({ status: 409, description: LOCKED })
  @HttpCode(204)
  async remove(
    @Param('id', ParseUUIDPipe) reportId: string,
    @Param('sourceId', ParseUUIDPipe) sourceId: string,
  ): Promise<void> {
    await this.calculator.remove({ reportId, sourceId });
  }

  @Post(':id/calculator/runs')
  @RequiresRole(MEMBERSHIP_ROLE.EDITOR, MEMBERSHIP_ROLE.ORGANIZATION_ADMINISTRATOR)
  @ApiOperation({
    summary: 'Record a calculation run',
    description:
      "Retains every line as it stands, pins the factor set in force for the report's period start (FR-35, P-11, " +
      'NFR-19), computes Scope 1 and location-based Scope 2, and writes them into B3 — where the total and the GHG ' +
      'intensity are derived from them. A scope with nothing measured clears only a figure an earlier run wrote.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiObjectResponse(CalcRunDto, { status: 201, description: 'The run, with every input it retained.' })
  @ApiResponse({ status: 400, description: 'A line the pinned factor set does not cover.' })
  @ApiResponse({ status: 404, description: NO_SUCH_REPORT })
  @ApiResponse({ status: 409, description: `${LOCKED} Or no factor set serves the period, or there are no lines.` })
  async run(@Param('id', ParseUUIDPipe) reportId: string): Promise<CalcRunDto> {
    return new CalcRunDto(await this.calculator.run({ reportId }));
  }

  @Get(':id/calculator/runs/:runId')
  @RequiresRole(MEMBERSHIP_ROLE.EDITOR, MEMBERSHIP_ROLE.ORGANIZATION_ADMINISTRATOR, MEMBERSHIP_ROLE.VIEWER)
  @ApiOperation({
    summary: 'One recorded run, computed again against its own factor set',
    description:
      'What the run read, the factor set it is pinned to, and each line\'s derivation — input, MWh, factor applied, ' +
      'tonnes (UX-42) — recomputed from the retained inputs against the pinned set, never the one now in force, with ' +
      'whether that reproduces what the run stored (NFR-19).',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiParam({ name: 'runId', format: 'uuid' })
  @ApiObjectResponse(CalcRunReplayDto, { status: 200, description: 'The run, replayed.' })
  @ApiResponse({ status: 404, description: NO_SUCH_RUN })
  async replay(
    @Param('id', ParseUUIDPipe) reportId: string,
    @Param('runId', ParseUUIDPipe) runId: string,
  ): Promise<CalcRunReplayDto> {
    return new CalcRunReplayDto(await this.calculator.replay({ reportId, runId }));
  }

  @Put(':id/calculator/figures/:elementKey/override')
  @RequiresRole(MEMBERSHIP_ROLE.EDITOR, MEMBERSHIP_ROLE.ORGANIZATION_ADMINISTRATOR)
  @ApiOperation({
    summary: 'Replace a computed B3 figure with your own, and say why',
    description:
      'UC-34 (FR-36): Scope 1 or location-based Scope 2 as a whole, superseded by the reporter’s tonnes with a ' +
      'required reason (UX-43). The computed figure stays — the latest run’s stored result — and the next run replaces ' +
      'the override. Refused where nothing computed the figure.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiParam({ name: 'elementKey', example: 'GrossScope1GreenhouseGasEmissions' })
  @ApiResponse({ status: 204, description: 'Overridden, and the total and intensity recomputed over it.' })
  @ApiResponse({ status: 400, description: 'Not a figure the calculator produces, or no tonnes or no reason.' })
  @ApiResponse({ status: 404, description: NO_SUCH_REPORT })
  @ApiResponse({ status: 409, description: `${LOCKED} Or nothing computed the figure.` })
  @HttpCode(204)
  async override(
    @Param('id', ParseUUIDPipe) reportId: string,
    @Param('elementKey') elementKey: string,
    @Body() body: OverrideFigureRequestDto,
  ): Promise<void> {
    await this.calculator.override({ reportId, elementKey, valueNumeric: body.valueNumeric, explanation: body.explanation });
  }

  @Delete(':id/calculator/figures/:elementKey/override')
  @RequiresRole(MEMBERSHIP_ROLE.EDITOR, MEMBERSHIP_ROLE.ORGANIZATION_ADMINISTRATOR)
  @ApiOperation({
    summary: 'Remove an override, putting the computed figure back',
    description: 'One action, nothing re-entered: the latest run’s stored result returns as the figure. No override, no change.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiParam({ name: 'elementKey', example: 'GrossScope1GreenhouseGasEmissions' })
  @ApiResponse({ status: 204, description: 'The computed figure is in force.' })
  @ApiResponse({ status: 400, description: 'Not a figure the calculator produces.' })
  @ApiResponse({ status: 404, description: NO_SUCH_REPORT })
  @ApiResponse({ status: 409, description: LOCKED })
  @HttpCode(204)
  async restore(
    @Param('id', ParseUUIDPipe) reportId: string,
    @Param('elementKey') elementKey: string,
  ): Promise<void> {
    await this.calculator.restore({ reportId, elementKey });
  }

  @Put(':id/calculator/figures/:elementKey/explanation')
  @RequiresRole(MEMBERSHIP_ROLE.EDITOR, MEMBERSHIP_ROLE.ORGANIZATION_ADMINISTRATOR)
  @ApiOperation({
    summary: 'Explain a computed B3 figure, or remove its note',
    description: 'UC-34 (FR-36): a note that stays beside a figure the calculator computed and that still stands.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiParam({ name: 'elementKey', example: 'GrossScope1GreenhouseGasEmissions' })
  @ApiResponse({ status: 204, description: 'The note is stored, or removed.' })
  @ApiResponse({ status: 400, description: 'Not a figure the calculator produces.' })
  @ApiResponse({ status: 404, description: NO_SUCH_REPORT })
  @ApiResponse({ status: 409, description: `${LOCKED} Or the figure is not a computed one that stands.` })
  @HttpCode(204)
  async explain(
    @Param('id', ParseUUIDPipe) reportId: string,
    @Param('elementKey') elementKey: string,
    @Body() body: ExplainFigureRequestDto,
  ): Promise<void> {
    await this.calculator.explain({ reportId, elementKey, explanation: body.explanation ?? null });
  }
}
