import { ApiProperty } from '@nestjs/swagger';
import { VERDICT, type FieldAddress, type RuleSet, type Verdict } from '@easyesg/validation';
import type { EpochMillis } from '@api/contracts/types/time';
import { LegalDateDto } from '@api/modules/core/period/dto/reporting-period.dto';
import {
  COMPLETION_STATUS,
  completionStatus,
  type CompletionStatus,
  type Counts,
  type ModuleRollUp,
  type RollUp,
} from '../models/roll-up.model';
import type {
  FieldPlace,
  NamedValidation,
  PlacedFinding,
  ValidationRules,
  ValidationRun,
} from '../models/validation-run.model';

const VERDICTS = Object.values(VERDICT);
const STATUSES = Object.values(COMPLETION_STATUS);

/** Where a finding sits — the disclosure store's natural key within the report, what a deep link lands on (FR-42). */
export class FieldAddressDto implements FieldAddress {
  @ApiProperty({ example: 'NumberOfEmployees' })
  readonly elementKey: string;

  @ApiProperty({ example: '', description: "An axis member, or '' where the element is undimensioned." })
  readonly dimensionKey: string;

  @ApiProperty({ minimum: 0, description: 'Position within a repeating group; 0 otherwise.' })
  readonly ordinal: number;

  constructor(address: FieldAddress) {
    this.elementKey = address.elementKey;
    this.dimensionKey = address.dimensionKey;
    this.ordinal = address.ordinal;
  }
}

/**
 * A finding's field, named and placed (task 42.2; FR-42, S-08) — the address, the label and the member's in the
 * reader's locale, and the modules that present it, so a reader can name a field in a module they have not opened and
 * reach the step that answers it.
 */
export class FindingFieldDto extends FieldAddressDto {
  @ApiProperty({
    nullable: true,
    type: String,
    example: 'Numărul de angajați',
    description: 'The field’s label in the request’s language, as the step read words it; null where none is worded.',
  })
  readonly label: string | null;

  @ApiProperty({
    nullable: true,
    type: String,
    description:
      'The axis member’s label, where the catalogue words one; null for an undimensioned field and for a member it ' +
      'does not word — a country, which a client words from its own catalogue by the member’s ISO code.',
  })
  readonly memberLabel: string | null;

  @ApiProperty({
    type: [String],
    example: ['B8'],
    description: 'The modules of the report’s scope that present the field, in the standard’s order; empty where none does.',
  })
  readonly modules: string[];

  constructor(place: FieldPlace) {
    super(place);
    this.label = place.label;
    this.memberLabel = place.memberLabel;
    this.modules = [...place.modules];
  }
}

/**
 * What a rule says about a field (FR-40, FR-42). **Its wording is not here**: `message` is a catalogue key and `params`
 * the values its wording quotes, decimals as canonical text and an address verbatim (OQ-43, NFR-26) — so the same
 * finding reads in any locale, and the browser's inline verdict and this one are the same bytes (task 40.3).
 */
export class ValidationFindingDto {
  @ApiProperty({ example: 'b1-turnover', description: 'The rule within its set.' })
  readonly rule: string;

  @ApiProperty({ enum: VERDICTS, description: 'FR-40’s verdict. A field with no finding is OK.' })
  readonly verdict: Verdict;

  @ApiProperty({ type: FindingFieldDto })
  readonly field: FindingFieldDto;

  @ApiProperty({ type: [FindingFieldDto], description: 'The fields it conflicts with, or that may answer it (FR-42 item 4).' })
  readonly related: FindingFieldDto[];

  @ApiProperty({ example: 'validation.required', description: 'The catalogue key its wording is resolved by.' })
  readonly message: string;

  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'string' },
    description: 'The values its wording quotes, by name — decimals as canonical text. Empty where it quotes none.',
  })
  readonly params: Record<string, string>;

  constructor(finding: PlacedFinding) {
    this.rule = finding.rule;
    this.verdict = finding.verdict;
    this.field = new FindingFieldDto(finding.field);
    this.related = finding.related.map((place) => new FindingFieldDto(place));
    this.message = finding.message;
    this.params = { ...finding.params };
  }
}

/** When the findings were computed, and against which day's rules (FR-43, FR-73 item 9). */
export class ValidationRunDto {
  // `type` stated: the alias erases to `number` at compile time and reflects as an object under ts-jest.
  @ApiProperty({ type: Number, description: 'When the run evaluated — epoch milliseconds, UTC.' })
  readonly evaluatedAt: EpochMillis;

  @ApiProperty({
    type: LegalDateDto,
    description: 'The day the rule set was read as at: today in the period’s zone, or the day its lock pinned.',
  })
  readonly rulesOn: LegalDateDto;

  constructor(run: ValidationRun) {
    this.evaluatedAt = run.evaluatedAt.getTime();
    this.rulesOn = Object.assign(new LegalDateDto(), run.rulesOn);
  }
}

/** Counts and the status derived from them, for a module or the report (182/18) — never a percentage. */
export class CountsDto implements Counts {
  @ApiProperty({ minimum: 0, description: 'Answered — a value or a nil return — with nothing outstanding on it.' })
  readonly resolved: number;

  @ApiProperty({ minimum: 0, description: 'Declared not available with its reason (FR-32), nothing outstanding on it.' })
  readonly reasoned: number;

  @ApiProperty({ minimum: 0, description: 'Carrying a finding.' })
  readonly outstanding: number;

  @ApiProperty({
    enum: STATUSES,
    description:
      'Not started while nothing is resolved or reasoned, in progress while something is outstanding, complete ' +
      'otherwise — for the report, complete is ready to file (182/19).',
  })
  readonly status: CompletionStatus;

  constructor(counts: Counts) {
    this.resolved = counts.resolved;
    this.reasoned = counts.reasoned;
    this.outstanding = counts.outstanding;
    this.status = completionStatus(counts);
  }
}

/** One module's roll-up, with the fields outstanding in it (FR-41 AC-6). */
export class ModuleRollUpDto extends CountsDto {
  @ApiProperty({ example: 'B8', description: 'The module, by the standard’s own reference.' })
  readonly module: string;

  @ApiProperty({ type: [FieldAddressDto], description: 'The fields outstanding in it, as findings name them.' })
  readonly outstandingFields: FieldAddressDto[];

  constructor(module: ModuleRollUp) {
    super(module);
    this.module = module.module;
    this.outstandingFields = module.outstandingFields.map((address) => new FieldAddressDto(address));
  }
}

/** UC-38's single readiness signal (FR-41; 182/18): per module, in the standard's order, and for the report. */
export class RollUpDto {
  @ApiProperty({ type: CountsDto, description: 'Each field counted once, whatever modules present it.' })
  readonly report: CountsDto;

  @ApiProperty({ type: [ModuleRollUpDto], description: 'Every module in the report’s scope, untouched ones included.' })
  readonly modules: ModuleRollUpDto[];

  constructor(rollUp: RollUp) {
    this.report = new CountsDto(rollUp.report);
    this.modules = rollUp.modules.map((module) => new ModuleRollUpDto(module));
  }
}

/**
 * A report's validation as it stands (UC-40, UC-38; FR-40, FR-41, FR-43): the last run, what it found — a finding whose
 * field has left the report's scope since dropped (182/26) — and what it came to, as the run left it. `run` and
 * `rollUp` are null for a report never validated.
 */
export class ValidationDto {
  @ApiProperty({ type: ValidationRunDto, nullable: true, description: 'Null where the report was never validated.' })
  readonly run: ValidationRunDto | null;

  @ApiProperty({ type: [ValidationFindingDto], description: 'In rule order, then the store’s natural key.' })
  readonly findings: ValidationFindingDto[];

  @ApiProperty({
    type: RollUpDto,
    nullable: true,
    description: 'What the run came to, as it left it (FR-41 item 8). Null where the report was never validated.',
  })
  readonly rollUp: RollUpDto | null;

  constructor(reading: NamedValidation) {
    this.run = reading.run === null ? null : new ValidationRunDto(reading.run);
    this.findings = reading.findings.map((finding) => new ValidationFindingDto(finding));
    this.rollUp = reading.rollUp === null ? null : new RollUpDto(reading.rollUp);
  }
}

/**
 * What the browser evaluates inline (task 42.1; FR-40 item 5, OQ-49; §12.5.6's task-42 row (1)): the rules a run would
 * read now, and the elements of the report's scope as a run computes them.
 *
 * **The rule set crosses as the configuration store holds it**, an object the wire describes no further: its vocabulary
 * is `@easyesg/validation`'s, and the browser admits it through that package's own `readRuleSet` — the one reader a rule
 * set is read by (task 40.1) — rather than through a second description of eight kinds here that could drift from it.
 */
export class ValidationRulesDto {
  @ApiProperty({
    type: LegalDateDto,
    description: 'The day the rule set is read as at: today in the period’s zone, or the day its lock pinned.',
  })
  readonly rulesOn: LegalDateDto;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    description:
      'The rule set, `{ rules }`, as the configuration store holds it — read with @easyesg/validation’s readRuleSet, ' +
      'which refuses what its vocabulary cannot hold.',
  })
  readonly ruleSet: RuleSet;

  @ApiProperty({
    type: [String],
    description:
      'The elements a rule may read — those that apply, are in the report’s scope and are not withheld by an omission ' +
      '(FR-28, FR-31, FR-177). A rule naming any other is not evaluated.',
  })
  readonly scope: string[];

  constructor(rules: ValidationRules) {
    this.rulesOn = Object.assign(new LegalDateDto(), rules.rulesOn);
    this.ruleSet = rules.ruleSet;
    this.scope = [...rules.scope];
  }
}
