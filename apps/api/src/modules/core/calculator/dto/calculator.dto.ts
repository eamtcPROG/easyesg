import { ApiProperty } from '@nestjs/swagger';
import type { EpochMillis } from '@api/contracts/types/time';
import type { ScopeTotal } from '../domain/scope-total';
import type { CalcResult } from '../models/calc-run.model';
import { GHG_SCOPE, type FactorSet, type FactorSource, type GhgScope } from '../models/factor-set.model';
import type { CalcSite, CalculatorView } from '../models/calculator-view.model';
import { PinnedFactorSetDto, ScopeResultDto } from './calc-run.dto';
import { CalcSourceDto } from './calc-source.dto';

const SCOPES = Object.values(GHG_SCOPE);

/** One energy source a line may name, and the invoice units it admits (FR-33, UX-14, UX-40). */
export class CalcFactorSourceDto {
  @ApiProperty({ example: 'natural_gas', description: 'The source’s key — a catalogue key its name resolves by.' })
  readonly key: string;

  @ApiProperty({ enum: SCOPES, description: 'Which B3 figure the source’s emissions count toward.' })
  readonly ghgScope: GhgScope;

  @ApiProperty({
    type: [String],
    example: ['m3'],
    description: 'The units a line of it may be entered in, as the factor set lists them — catalogue keys too.',
  })
  readonly units: string[];

  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'string' },
    example: { m3: '0.0095773' },
    description:
      'The MWh one of each unit amounts to, as a decimal string, exactly as the set publishes it — the conversion ' +
      'step of UX-42’s derivation (task 39.2).',
  })
  readonly megawattHoursPerUnit: Record<string, string>;

  @ApiProperty({
    example: '0.202544',
    description: 'Tonnes of CO₂e per MWh of the source, as a decimal string, exactly as published — the factor applied.',
  })
  readonly emissionFactor: string;

  @ApiProperty({ description: 'Where the factor comes from — the publication, table and edition. Data, not wording.' })
  readonly reference: string;

  constructor(source: FactorSource) {
    this.key = source.key;
    this.ghgScope = source.ghgScope;
    this.units = [...source.units.keys()];
    this.megawattHoursPerUnit = Object.fromEntries(source.units);
    this.emissionFactor = source.emissionFactor;
    this.reference = source.reference;
  }
}

/** The factor set the report's period resolves, with what it lets a line say. */
export class CalcFactorSetDto extends PinnedFactorSetDto {
  @ApiProperty({ type: [CalcFactorSourceDto], description: 'Its sources, in the order they were published.' })
  readonly sources: CalcFactorSourceDto[];

  constructor(factorSet: FactorSet) {
    super(factorSet);
    this.sources = [...factorSet.sources.values()].map((source) => new CalcFactorSourceDto(source));
  }
}

/** One of the report's B1 site rows — where a line may belong. */
export class CalcSiteDto {
  @ApiProperty({ minimum: 0, description: 'Its row on the site axis — what a line’s `siteOrdinal` names.' })
  readonly ordinal: number;

  @ApiProperty({
    type: String,
    nullable: true,
    example: 'Str. Alba Iulia 21, Chișinău',
    description: 'What B1 calls it, as the wizard names the row; null where nothing in B1 names it yet.',
  })
  readonly name: string | null;

  constructor(site: CalcSite) {
    this.ordinal = site.ordinal;
    this.name = site.name;
  }
}

/** What the lines come to now, against the set in force — not a run, and nothing retained (task 39.2). */
export class CalcWorkingDto {
  @ApiProperty({
    type: [ScopeResultDto],
    description: 'Scope 1, then location-based Scope 2, as a run recorded now would compute them, line by line.',
  })
  readonly scopes: ScopeResultDto[];

  @ApiProperty({
    type: [String],
    description: 'Lines the set in force no longer covers — a correction dropped their source or unit — which a run refuses.',
  })
  readonly uncovered: string[];

  constructor(working: { readonly scopes: readonly ScopeTotal[]; readonly uncovered: readonly string[] }) {
    this.scopes = working.scopes.map((scope) => new ScopeResultDto(scope));
    this.uncovered = [...working.uncovered];
  }
}

/** One B3 figure a run stored. */
export class CalcStoredResultDto {
  @ApiProperty({ example: 'GrossScope1GreenhouseGasEmissions' })
  readonly elementKey: string;

  @ApiProperty({ type: String, nullable: true, description: 'Tonnes of CO₂e, unrounded; null where nothing was measured.' })
  readonly tonnesCo2e: string | null;

  constructor(result: CalcResult) {
    this.elementKey = result.elementKey;
    this.tonnesCo2e = result.tonnesCo2e;
  }
}

/** The set a run pinned, as a reader is shown it — the label `null` only where the pin reads as nothing. */
export class CalcRunPinDto {
  @ApiProperty({ example: 'md' })
  readonly country: string;

  @ApiProperty({ example: 1 })
  readonly revision: number;

  @ApiProperty({ type: String, nullable: true, example: '2026.1' })
  readonly label: string | null;

  constructor(input: { readonly pin: { readonly country: string; readonly revision: number }; readonly set: FactorSet | null }) {
    this.country = input.pin.country;
    this.revision = input.pin.revision;
    this.label = input.set?.label ?? null;
  }
}

/** The report's latest run: what B3 holds from it, the set it pinned, and when (task 39.2; UX-44). */
export class CalcLatestRunDto {
  @ApiProperty({ format: 'uuid' })
  readonly id: string;

  @ApiProperty({ type: CalcRunPinDto })
  readonly factorSet: CalcRunPinDto;

  @ApiProperty({ type: Number, description: 'Unix epoch milliseconds, UTC.' })
  readonly recordedAt: EpochMillis;

  @ApiProperty({ type: [CalcStoredResultDto], description: 'What it wrote into B3.' })
  readonly results: CalcStoredResultDto[];

  constructor(run: NonNullable<CalculatorView['latestRun']>) {
    this.id = run.id;
    this.factorSet = new CalcRunPinDto({ pin: run.factorSet, set: run.pinned });
    this.recordedAt = run.recordedAt.getTime();
    this.results = run.results.map((result) => new CalcStoredResultDto(result));
  }
}

/** The carbon calculator as S-09 opens it (task 39.1; FR-33, UX-40, UX-41). */
export class CalculatorDto {
  @ApiProperty({
    type: CalcFactorSetDto,
    nullable: true,
    description: 'The set the report’s period resolves, or null where none serves it — and then no line can be written.',
  })
  readonly factorSet: CalcFactorSetDto | null;

  @ApiProperty({ type: [CalcSiteDto], description: 'The report’s B1 site rows. Empty until B1 records a site.' })
  readonly sites: CalcSiteDto[];

  @ApiProperty({
    type: [String],
    nullable: true,
    example: ['2026-01', '2026-02', '2026-03'],
    description:
      'The twelve calendar months, `YYYY-MM`, that the monthly form’s rows stand for, from the period’s start — or ' +
      'null where the period does not span twelve calendar months, and a line takes one figure for the period.',
  })
  readonly months: string[] | null;

  @ApiProperty({ type: [CalcSourceDto], description: 'The report’s invoice lines, oldest first.' })
  readonly sources: CalcSourceDto[];

  @ApiProperty({
    type: CalcWorkingDto,
    nullable: true,
    description: 'What the lines come to now against the set in force (task 39.2), or null where no set serves the period.',
  })
  readonly working: CalcWorkingDto | null;

  @ApiProperty({ type: CalcLatestRunDto, nullable: true, description: 'The latest recorded run, or null before the first.' })
  readonly latestRun: CalcLatestRunDto | null;

  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'integer' },
    example: { tCO2e: 2, MWh: 2 },
    description:
      'Decimal places by unit, as every surface rounds a computed figure — once, half-up (182/3). A unit absent is ' +
      'shown unrounded.',
  })
  readonly precision: Record<string, number>;

  constructor(view: CalculatorView) {
    this.factorSet = view.factorSet === null ? null : new CalcFactorSetDto(view.factorSet);
    this.sites = view.sites.map((site) => new CalcSiteDto(site));
    this.months = view.months === null ? null : [...view.months];
    this.sources = view.sources.map((source) => new CalcSourceDto(source));
    this.working = view.working === null ? null : new CalcWorkingDto(view.working);
    this.latestRun = view.latestRun === null ? null : new CalcLatestRunDto(view.latestRun);
    this.precision = { ...view.precision };
  }
}

/** The figures B3 took from the calculator — the latest run, for S-07's B3 fields (task 39.3; UX-43). */
export class CalcFiguresDto {
  @ApiProperty({
    type: CalcLatestRunDto,
    nullable: true,
    description: 'The latest run: what it stored for each scope — the computed figure an override supersedes — or null.',
  })
  readonly latestRun: CalcLatestRunDto | null;

  constructor(figures: { readonly latestRun: CalculatorView['latestRun'] }) {
    this.latestRun = figures.latestRun === null ? null : new CalcLatestRunDto(figures.latestRun);
  }
}
