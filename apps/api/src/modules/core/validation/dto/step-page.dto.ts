import { ApiProperty } from '@nestjs/swagger';
import { PriorPeriodResponseDto } from '@api/modules/core/comparatives/dto/prior-period.dto';
import { ReportResponseDto } from '@api/modules/core/disclosure/dto/report.dto';
import { DisclosureModuleSummaryDto, DisclosureStepDto } from '@api/modules/core/disclosure/dto/wizard-step.dto';
import type { StepPage } from '../models/step-page.model';
import { ValidationDto, ValidationRulesDto } from './validation.dto';

/**
 * S-07's step in one read (task 244) — each member the object its own route answers, so a client reads the parts with
 * the readers it already has for them.
 */
export class StepPageDto {
  @ApiProperty({ type: ReportResponseDto, description: 'The report, as `GET /reports/{id}` answers it.' })
  readonly report: ReportResponseDto;

  @ApiProperty({
    type: [DisclosureModuleSummaryDto],
    description: 'The modules the pinned version carries, as `GET /reports/{id}/modules` answers them.',
  })
  readonly modules: DisclosureModuleSummaryDto[];

  @ApiProperty({ type: DisclosureStepDto, description: 'The step, as `GET /reports/{id}/modules/{module}` answers it.' })
  readonly step: DisclosureStepDto;

  @ApiProperty({
    type: PriorPeriodResponseDto,
    description:
      'The prior period’s answers for the step’s own elements only — `GET /reports/{id}/prior-period` narrowed to ' +
      'the fields the step shows.',
  })
  readonly prior: PriorPeriodResponseDto;

  @ApiProperty({ type: ValidationDto, description: 'What the last run found, as `GET /reports/{id}/validation` answers it.' })
  readonly validation: ValidationDto;

  @ApiProperty({
    type: ValidationRulesDto,
    nullable: true,
    description:
      'The rules the report is checked against, as `GET /reports/{id}/validation/rules` answers them — null where no ' +
      'rule set can be read, which the step renders without (validation is an aid, never a precondition).',
  })
  readonly rules: ValidationRulesDto | null;

  constructor(page: StepPage) {
    this.report = new ReportResponseDto(page.report, page.adopted);
    this.modules = page.modules.map((summary) => new DisclosureModuleSummaryDto(summary));
    this.step = new DisclosureStepDto(page.step);
    this.prior = new PriorPeriodResponseDto(page.prior);
    this.validation = new ValidationDto(page.validation);
    this.rules = page.rules === null ? null : new ValidationRulesDto(page.rules);
  }
}
