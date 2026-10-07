import { ApiProperty } from '@nestjs/swagger';
import type { EpochMillis } from '@api/contracts/types/time';
import { OverridingPersonDto } from '@api/modules/core/disclosure/dto/overriding-person.dto';
import { LINE_OUTCOME, type LineEmission, type LineOutcome } from '../domain/line-emission';
import type { ScopeTotal } from '../domain/scope-total';
import { B3_ELEMENT_FOR_SCOPE } from '../models/b3-element.model';
import type { CalcInput, CalcRun } from '../models/calc-run.model';
import { GHG_SCOPE, type FactorSet, type GhgScope } from '../models/factor-set.model';

const OUTCOMES = Object.values(LINE_OUTCOME);
const SCOPES = Object.values(GHG_SCOPE);

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

  @ApiProperty({ type: String, nullable: true, description: 'The reporter’s tonnes in place of the computed ones.' })
  readonly overrideTonnes: string | null;

  @ApiProperty({ type: String, nullable: true })
  readonly overrideExplanation: string | null;

  @ApiProperty({
    type: OverridingPersonDto,
    nullable: true,
    description: 'Who had replaced the line’s tonnes when the run read it (FR-36); null where nothing was replaced.',
  })
  readonly overriddenBy: OverridingPersonDto | null;

  constructor(input: CalcInput) {
    this.sourceId = input.sourceId;
    this.siteOrdinal = input.siteOrdinal;
    this.sourceKey = input.sourceKey;
    this.description = input.description;
    this.quantity = input.contents.quantity;
    this.unitCode = input.contents.unitCode;
    this.notAvailableReason = input.contents.notAvailableReason;
    this.overrideTonnes = input.override?.tonnesCo2e ?? null;
    this.overrideExplanation = input.override?.explanation ?? null;
    this.overriddenBy = input.overriddenBy === null ? null : new OverridingPersonDto(input.overriddenBy);
  }
}

/** One line's two steps — MWh, then tonnes — or that it had no figure, or that its tonnes were replaced (UX-42). */
export class ScopeLineDto {
  @ApiProperty({ format: 'uuid', description: 'The line, as the run retained it.' })
  readonly sourceId: string;

  @ApiProperty({ enum: OUTCOMES, description: 'Measured, explained with no figure, or measured and replaced.' })
  readonly outcome: LineOutcome;

  @ApiProperty({ type: String, nullable: true, description: 'The energy it stands for, in MWh; null where explained.' })
  readonly megawattHours: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Its emissions in tCO₂e as the scope counts them, unrounded — the reporter’s where overridden.',
  })
  readonly tonnesCo2e: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Where overridden, what the factors give — superseded and kept beside the substitute (UX-43).',
  })
  readonly computedTonnesCo2e: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Where overridden, why.' })
  readonly explanation: string | null;

  constructor(line: LineEmission) {
    this.sourceId = line.sourceId;
    this.outcome = line.outcome;
    this.megawattHours = line.outcome === LINE_OUTCOME.NOT_AVAILABLE ? null : line.megawattHours;
    this.tonnesCo2e = line.outcome === LINE_OUTCOME.NOT_AVAILABLE ? null : line.tonnesCo2e;
    this.computedTonnesCo2e = line.outcome === LINE_OUTCOME.OVERRIDDEN ? line.computedTonnesCo2e : null;
    this.explanation = line.outcome === LINE_OUTCOME.OVERRIDDEN ? line.explanation : null;
  }
}

/** One scope's figure and the lines behind it (FR-34). */
export class ScopeResultDto {
  @ApiProperty({ enum: SCOPES })
  readonly ghgScope: GhgScope;

  @ApiProperty({ example: 'GrossScope1GreenhouseGasEmissions', description: 'The B3 element it answers.' })
  readonly elementKey: string;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Tonnes of CO₂e, unrounded and exact; null where no line of the scope was measured — never zero.',
  })
  readonly tonnesCo2e: string | null;

  @ApiProperty({ type: [String], description: 'The lines of the scope with no figure — what the total leaves out.' })
  readonly unmeasured: readonly string[];

  @ApiProperty({ type: [ScopeLineDto] })
  readonly lines: ScopeLineDto[];

  constructor(scope: ScopeTotal) {
    this.ghgScope = scope.ghgScope;
    this.elementKey = B3_ELEMENT_FOR_SCOPE[scope.ghgScope];
    this.tonnesCo2e = scope.tonnesCo2e;
    this.unmeasured = scope.unmeasured;
    this.lines = scope.lines.map((line) => new ScopeLineDto(line));
  }
}

/** A recorded run: what it read, which factors it is pinned to, and what it computed (P-11, FR-34, FR-35). */
export class CalcRunDto {
  @ApiProperty({ format: 'uuid' })
  readonly id: string;

  @ApiProperty({ type: PinnedFactorSetDto })
  readonly factorSet: PinnedFactorSetDto;

  @ApiProperty({ type: Number, description: 'Unix epoch milliseconds, UTC.' })
  readonly recordedAt: EpochMillis;

  @ApiProperty({ type: [CalcInputDto], description: 'Every line the report held when the run was recorded.' })
  readonly inputs: CalcInputDto[];

  @ApiProperty({
    type: [ScopeResultDto],
    description: 'Scope 1, then location-based Scope 2 — the figures the run wrote into B3, with their derivation.',
  })
  readonly scopes: ScopeResultDto[];

  constructor(input: { readonly run: CalcRun; readonly factorSet: FactorSet; readonly scopes: readonly ScopeTotal[] }) {
    this.id = input.run.id;
    this.factorSet = new PinnedFactorSetDto(input.factorSet);
    this.recordedAt = input.run.recordedAt.getTime();
    this.inputs = input.run.inputs.map((each) => new CalcInputDto(each));
    this.scopes = input.scopes.map((scope) => new ScopeResultDto(scope));
  }
}

/** A recorded run computed again against its own pinned set (NFR-19). */
export class CalcRunReplayDto extends CalcRunDto {
  @ApiProperty({
    description:
      'Whether computing the retained inputs again against the pinned factor set gives exactly the figures the run ' +
      'stored. False means the arithmetic or the record changed, never that the factors moved on.',
  })
  readonly reproduces: boolean;

  constructor(input: {
    readonly run: CalcRun;
    readonly factorSet: FactorSet;
    readonly scopes: readonly ScopeTotal[];
    readonly reproduces: boolean;
  }) {
    super(input);
    this.reproduces = input.reproduces;
  }
}
