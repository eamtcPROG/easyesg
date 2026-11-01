import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { DisclosureValue } from '../models/disclosure-value.model';
import type { WordedRefusedInput, WordedRefusedValue } from '../models/refused-write.model';
import { DisclosureValueResponseDto } from './wizard-step.dto';

/**
 * What a write answers (task 218; §12.5.6's task-218 row (a)) — one wire object with its parts: what it stored, and
 * each item it refused for that item's own sake, worded in the reader's language. A refusal of the report is a problem
 * document instead, carrying no `refused`.
 */
export class RefusedValueDto implements WordedRefusedValue {
  @ApiProperty({ example: 'EnergyConsumptionFromElectricity' })
  readonly elementKey: string;

  @ApiProperty({ example: 'RenewableEnergyMember', description: 'Empty where the field has no dimension.' })
  readonly dimensionKey: string;

  @ApiProperty({ minimum: 0 })
  readonly ordinal: number;

  @ApiProperty({ type: [String], example: ['B3'], description: 'The modules presenting the field, to lead to it.' })
  readonly modules: readonly string[];

  @ApiProperty({ type: String, nullable: true, description: "The field's name in the reader's language." })
  readonly label: string | null;

  @ApiProperty({ type: String, nullable: true, description: "The member's name — the breakdown row or the choice." })
  readonly memberLabel: string | null;

  @ApiProperty({ description: 'The refusal’s problem type, as a problem document names it.' })
  readonly type: string;

  @ApiPropertyOptional({ description: 'The refusal’s title. Omitted where none is worded.' })
  readonly title?: string;

  @ApiPropertyOptional({ description: 'What happened, so what, and what now (NFR-79).' })
  readonly detail?: string;

  constructor(refused: WordedRefusedValue) {
    this.elementKey = refused.elementKey;
    this.dimensionKey = refused.dimensionKey;
    this.ordinal = refused.ordinal;
    this.modules = refused.modules;
    this.label = refused.label;
    this.memberLabel = refused.memberLabel;
    this.type = refused.type;
    this.title = refused.title;
    this.detail = refused.detail;
  }
}

export class WriteDisclosureValuesResponseDto {
  @ApiProperty({
    type: [DisclosureValueResponseDto],
    description: 'What was durably committed — UX-36 acknowledges the commit, not local state.',
  })
  readonly stored: DisclosureValueResponseDto[];

  @ApiProperty({ type: [RefusedValueDto], description: 'Each value refused for its own sake; the rest were stored.' })
  readonly refused: RefusedValueDto[];

  constructor(outcome: { readonly stored: DisclosureValue[]; readonly refused: readonly WordedRefusedValue[] }) {
    this.stored = outcome.stored.map((value) => new DisclosureValueResponseDto(value));
    this.refused = outcome.refused.map((refused) => new RefusedValueDto(refused));
  }
}

export class RefusedInputDto implements WordedRefusedInput {
  @ApiProperty({ example: 'AnnualHoursWorkedPerEmployee' })
  readonly inputKey: string;

  @ApiProperty({ description: 'The refusal’s problem type, as a problem document names it.' })
  readonly type: string;

  @ApiPropertyOptional({ description: 'The refusal’s title. Omitted where none is worded.' })
  readonly title?: string;

  @ApiPropertyOptional({ description: 'What happened, so what, and what now (NFR-79).' })
  readonly detail?: string;

  constructor(refused: WordedRefusedInput) {
    this.inputKey = refused.inputKey;
    this.type = refused.type;
    this.title = refused.title;
    this.detail = refused.detail;
  }
}

export class WriteDerivationInputsResponseDto {
  @ApiProperty({ type: [RefusedInputDto], description: 'Each input refused for its own sake; the rest were stored.' })
  readonly refused: RefusedInputDto[];

  constructor(outcome: { readonly refused: readonly WordedRefusedInput[] }) {
    this.refused = outcome.refused.map((refused) => new RefusedInputDto(refused));
  }
}
