import { ApiProperty } from '@nestjs/swagger';
import type { EpochMillis } from '@api/contracts/types/time';
import type { CalcInput, CalcRun } from '../models/calc-run.model';
import type { FactorSet } from '../models/factor-set.model';

/** The factor set a run pinned (FR-35): its identity, and the name it is shown by (UX-42). */
export class PinnedFactorSetDto {
  @ApiProperty({ example: 'md', description: 'The country whose set it is.' })
  readonly country: string;

  @ApiProperty({ example: 1, description: 'The immutable revision — what the run is pinned to.' })
  readonly revision: number;

  @ApiProperty({ example: '2026.1', description: 'The name its publisher gave it — what a reader is shown.' })
  readonly label: string;

  constructor(factorSet: FactorSet) {
    this.country = factorSet.pin.country;
    this.revision = factorSet.pin.revision;
    this.label = factorSet.label;
  }
}

/** One line as the run read it. */
export class CalcInputDto {
  @ApiProperty({ format: 'uuid', description: 'The line it was copied from.' })
  readonly sourceId: string;

  @ApiProperty({ minimum: 0 })
  readonly siteOrdinal: number;

  @ApiProperty({ example: 'natural_gas' })
  readonly sourceKey: string;

  @ApiProperty({ type: String, nullable: true })
  readonly description: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'A decimal string, never a number.' })
  readonly quantity: string | null;

  @ApiProperty({ type: String, nullable: true })
  readonly unitCode: string | null;

  @ApiProperty({ type: String, nullable: true })
  readonly notAvailableReason: string | null;

  constructor(input: CalcInput) {
    this.sourceId = input.sourceId;
    this.siteOrdinal = input.siteOrdinal;
    this.sourceKey = input.sourceKey;
    this.description = input.description;
    this.quantity = input.contents.quantity;
    this.unitCode = input.contents.unitCode;
    this.notAvailableReason = input.contents.notAvailableReason;
  }
}

/** A recorded run: what it read and which factors it is pinned to (P-11, FR-35). */
export class CalcRunDto {
  @ApiProperty({ format: 'uuid' })
  readonly id: string;

  @ApiProperty({ type: PinnedFactorSetDto })
  readonly factorSet: PinnedFactorSetDto;

  @ApiProperty({ type: Number, description: 'Unix epoch milliseconds, UTC.' })
  readonly recordedAt: EpochMillis;

  @ApiProperty({ type: [CalcInputDto], description: 'Every line the report held when the run was recorded.' })
  readonly inputs: CalcInputDto[];

  constructor(input: { readonly run: CalcRun; readonly factorSet: FactorSet }) {
    this.id = input.run.id;
    this.factorSet = new PinnedFactorSetDto(input.factorSet);
    this.recordedAt = input.run.recordedAt.getTime();
    this.inputs = input.run.inputs.map((each) => new CalcInputDto(each));
  }
}
