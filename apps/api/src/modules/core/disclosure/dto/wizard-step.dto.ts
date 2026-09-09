import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsNumberString,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { LOCALES, type Locale } from '@easyesg/i18n';
import { DISCLOSURE_KIND } from '@easyesg/vsme';
import { PERIOD_TYPE } from '@api/contracts/taxonomy-registry.port';
import type { EpochMillis } from '@api/contracts/types/time';
import { APPLICABILITY_CONDITION, type ApplicabilityCondition } from '../models/applicability.model';
import {
  DISCLOSURE_ORIGIN,
  DISCLOSURE_STATE,
  type DisclosureOrigin,
  type DisclosureState,
  type DisclosureValue,
} from '../models/disclosure-value.model';
import type {
  ApplicabilityDriver,
  DisclosureApplicabilityCause,
  DerivationInputField,
  DisclosureAxis,
  DisclosureDefault,
  DisclosureField,
  DisclosureModuleSummary,
  DisclosureOption,
  DisclosureStep,
} from '../models/wizard-step.model';

const ORIGINS = Object.values(DISCLOSURE_ORIGIN);
const STATES = Object.values(DISCLOSURE_STATE);
const KINDS = Object.values(DISCLOSURE_KIND);
const PERIOD_TYPES = Object.values(PERIOD_TYPE);
const CONDITIONS = Object.values(APPLICABILITY_CONDITION);

/** NFR-58's rule, stated once for the three numeric columns the surface carries. */
const DECIMAL_AS_STRING = 'Decimal as a string, never a float (NFR-58).';
/** A calendar date as `YYYY-MM-DD`, never an instant (§7.9). */
const DATE_EXAMPLE = '2026-12-31';

/**
 * **A batch is bounded.** FR-38 queues offline changes and flushes them on reconnect, so the size of
 * one write is set by how long someone worked offline rather than by a form. Unbounded, that is an
 * authenticated request whose cost the caller chooses; 143 is every reportable element of a version,
 * which is the largest honest flush.
 */
const MAX_VALUES_PER_WRITE = 143;

/** One B1 element an applicability rule reads, with its wording (task 91.3). */
export class ApplicabilityDriverDto {
  @ApiProperty({ example: 'NumberOfEmployees' })
  readonly elementKey: string;

  @ApiProperty({
    nullable: true,
    type: String,
    description:
      "The element's wording in the request's locale — what the announcement names, since an " +
      'element key is not something a reader may be shown. Null where the catalogue holds none.',
  })
  readonly label: string | null;

  constructor(driver: ApplicabilityDriver) {
    this.elementKey = driver.elementKey;
    this.label = driver.label;
  }
}

/** Why a field or a module does or does not apply (task 91.3; FR-28, UX-27). */
export class ApplicabilityCauseDto {
  @ApiProperty({
    enum: CONDITIONS,
    description:
      'How the rule decides. The client words the announcement from this plus the values below; ' +
      'no sentence is composed server-side.',
  })
  readonly condition: ApplicabilityCondition;

  @ApiProperty({ type: [ApplicabilityDriverDto], description: 'The B1 elements whose answers decide it.' })
  readonly drivers: ApplicabilityDriverDto[];

  @ApiProperty({
    nullable: true,
    type: String,
    example: '50',
    description: `${DECIMAL_AS_STRING} Null for conditions that carry no threshold.`,
  })
  readonly threshold: string | null;

  @ApiProperty({
    nullable: true,
    type: String,
    description:
      'What the reporter answered, as stored. Null where the deciding field is unanswered — the ' +
      'state every conditional field is in before B1 is filled in — or where the condition has no ' +
      'single answer to quote.',
  })
  readonly answer: string | null;

  constructor(cause: DisclosureApplicabilityCause) {
    this.condition = cause.condition;
    this.drivers = cause.drivers.map((driver) => new ApplicabilityDriverDto(driver));
    this.threshold = cause.threshold;
    this.answer = cause.answer;
  }
}

export class DisclosureModuleSummaryDto {
  @ApiProperty({ example: 'B8', description: "The standard's own module." })
  readonly module: string;

  @ApiProperty({ description: 'Fields with a stored answer, including nil return and not available.' })
  readonly answered: number;

  @ApiProperty({ description: 'Fields the pinned version puts in this module.' })
  readonly total: number;

  @ApiProperty({
    nullable: true,
    type: Number,
    description:
      "Unix epoch milliseconds, UTC — when the module's most recent answer was stored, or null " +
      'where nothing in it is answered. Where work last happened is where a returning reporter ' +
      'resumes (FR-39).',
  })
  readonly lastAnsweredAt: EpochMillis | null;

  @ApiProperty({
    description:
      'Whether the module has anything to answer (FR-28). True while any one of its elements ' +
      'applies; answered and total above count applicable elements only.',
  })
  readonly applicable: boolean;

  @ApiProperty({
    description:
      'The reporter has declared this module omitted as classified or sensitive information — ' +
      'UX-29’s distinct third value, neither complete nor incomplete (FR-31, UC-30). **Derived, ' +
      'never stored per module**: it is true when B1’s omitted-disclosures list carries the ' +
      'module’s own member or every one of its sections (VSME ¶19, ¶24(b)). The counts beside it ' +
      'stay honest — FR-31 has the declaration *satisfy* validation rather than suppress it.',
  })
  readonly omitted: boolean;

  @ApiProperty({
    nullable: true,
    type: ApplicabilityCauseDto,
    description:
      'Why the module does not apply, where its elements agree on one reason; null otherwise, ' +
      'including whenever the module applies.',
  })
  readonly applicabilityCause: ApplicabilityCauseDto | null;

  constructor(summary: DisclosureModuleSummary) {
    this.module = summary.module;
    this.answered = summary.answered;
    this.total = summary.total;
    this.lastAnsweredAt = summary.lastAnsweredAt;
    this.applicable = summary.applicable;
    this.omitted = summary.omitted;
    this.applicabilityCause =
      summary.applicabilityCause === null ? null : new ApplicabilityCauseDto(summary.applicabilityCause);
  }
}

/** One answer a choice field offers (task 91.1). */
export class DisclosureOptionDto {
  @ApiProperty({
    example: 'vsme:IndividualMember',
    description:
      "The member's taxonomy-qualified name — what an answer stores; the Excel export maps it to " +
      "the template's own value. An enumeration_set answer holds its chosen values space-separated.",
  })
  readonly value: string;

  @ApiProperty({
    nullable: true,
    type: String,
    description:
      "The member's wording in the request's locale; null where the platform holds none — ISO " +
      '3166 members, whose names the client resolves from its own catalogue.',
  })
  readonly label: string | null;

  @ApiProperty({ nullable: true, type: String, example: '01.11', description: "The classification's own code, where it has one." })
  readonly code: string | null;

  @ApiProperty({
    nullable: true,
    type: Boolean,
    description:
      'Whether the classification marks this entry hazardous; null where it says nothing — a NACE ' +
      'class and a pollutant are not "non-hazardous", they are outside a classification that makes ' +
      'the distinction. Carried because EFRAG’s own instruction cannot be followed without it: B7’s ' +
      'waste table says to select a type of waste that is Hazardous or Non-Hazardous, and the ' +
      'published list marks it with an asterisk on the code (01 03 04*) that this platform’s ' +
      'extracted code does not carry.',
  })
  readonly hazardous: boolean | null;

  constructor(option: DisclosureOption) {
    this.value = option.value;
    this.label = option.label;
    this.code = option.code;
    this.hazardous = option.hazardous;
  }
}

/** The entity record's answer for a field, in the write's own columns (task 91.2). */
export class DisclosureDefaultDto {
  @ApiProperty({ nullable: true, type: String, description: DECIMAL_AS_STRING })
  readonly valueNumeric: string | null;

  @ApiProperty({ nullable: true, type: String })
  readonly valueText: string | null;

  @ApiProperty({ nullable: true, type: Boolean })
  readonly valueBoolean: boolean | null;

  @ApiProperty({ nullable: true, type: String, example: DATE_EXAMPLE })
  readonly valueDate: string | null;

  constructor(value: DisclosureDefault) {
    this.valueNumeric = value.valueNumeric;
    this.valueText = value.valueText;
    this.valueBoolean = value.valueBoolean;
    this.valueDate = value.valueDate;
  }
}

export class DisclosureFieldDto {
  @ApiProperty({ example: 'NumberOfEmployees' })
  readonly elementKey: string;

  @ApiProperty({ description: 'An axis member, or empty where the element is undimensioned.' })
  readonly dimensionKey: string;

  @ApiProperty({
    type: String,
    nullable: true,
    description:
      'What to call this row. A member-keyed row is named by its member (“Renewable energy”, ' +
      '“Ammonia (NH3)”); a typed-axis row by what the report shows for that ordinal — B1’s ' +
      'address for the site B5 is asking about, which is the stored answer where there is one and ' +
      'the entity snapshot’s default otherwise. Null where neither answers, and null where the ' +
      'pinned version names the member nothing; the key is never a fallback, because it is an ' +
      'internal identifier, and the screen keeps the position, so an unnamed row is still “site 2”.',
  })
  readonly dimensionLabel: string | null;

  @ApiProperty({
    enum: ORIGINS,
    description:
      'Where the stored value came from. `reported` on every row today — the calculator that ' +
      'writes `calculated` is task 39.2 and the override that writes `overridden` is task 38.5, ' +
      'so a client may render the other two but will not meet them yet.',
  })
  readonly origin: DisclosureOrigin;

  @ApiProperty({ description: 'Position within a repeating group; 0 where there is none.' })
  readonly ordinal: number;

  @ApiProperty({ enum: KINDS, description: 'Which of the typed columns this element answers into.' })
  readonly kind: string;

  @ApiProperty({
    enum: PERIOD_TYPES,
    description:
      'Reported FOR the period (duration) or AS AT a moment in it (instant). The two compare ' +
      'differently against the prior period.',
  })
  readonly periodType: string;

  @ApiProperty({ type: [String], description: 'Axes this element is dimensioned along; empty for most.' })
  readonly axes: string[];

  @ApiProperty({
    description:
      'Whether this field is one row of a repeating group — an element on a typed axis, whose rows ' +
      'are sites, subsidiaries or materials the reporter adds. Not derivable from axes: several ' +
      'elements share a fixed member axis too.',
  })
  readonly repeating: boolean;

  @ApiProperty({ description: "EFRAG's own presentation order within the module." })
  readonly order: number;

  @ApiProperty({
    nullable: true,
    type: String,
    description: 'Null where the pinned version carries no label for this element in this locale.',
  })
  readonly label: string | null;

  @ApiProperty({
    nullable: true,
    type: String,
    description:
      "Whether the wording is EFRAG's own or platform-authored. Carried per field because it " +
      'travels with the text — of three locales only English is official.',
  })
  readonly labelStanding: string | null;

  @ApiProperty({
    nullable: true,
    type: String,
    description:
      "EFRAG's documentation label for the element, or null where the package carries none (UX-17).",
  })
  readonly help: string | null;

  @ApiProperty({
    nullable: true,
    type: [DisclosureOptionDto],
    description:
      'The answers a choice field offers; null for every kind that is not an enumeration.',
  })
  readonly options: DisclosureOptionDto[] | null;

  @ApiProperty({
    nullable: true,
    type: DisclosureDefaultDto,
    description:
      'What the field would hold if the reporter accepted what the platform already knows — the ' +
      'entity record, or the report’s own scope. Null once any row is stored for this key, and null ' +
      'for every field the platform cannot answer. Committed by the client on blur or step change; ' +
      'never stored by the read.',
  })
  readonly defaultValue: DisclosureDefaultDto | null;

  @ApiProperty({ nullable: true, type: String, description: DECIMAL_AS_STRING })
  readonly valueNumeric: string | null;

  @ApiProperty({ nullable: true, type: String })
  readonly valueText: string | null;

  @ApiProperty({ nullable: true, type: Boolean })
  readonly valueBoolean: boolean | null;

  @ApiProperty({ nullable: true, type: String, example: DATE_EXAMPLE })
  readonly valueDate: string | null;

  @ApiProperty({ nullable: true, type: String })
  readonly unitCode: string | null;

  @ApiProperty({
    type: [String],
    description:
      'The units the standard admits for this element (UX-14). Empty where EFRAG states none — ' +
      'which is not the same as the element taking no unit. One entry is a fixed unit to show; ' +
      'several are the constrained list to choose from. On the field and deliberately not on a ' +
      'stored value: this is what a row MAY hold, `unitCode` is what it does.',
    example: ['kg', 't'],
  })
  readonly unitCodes: string[];

  @ApiProperty({
    nullable: true,
    type: String,
    example: 'MDL',
    description:
      'The filing’s currency for a monetary element, ISO 4217 alpha-3; null for every other kind ' +
      '(task 36.12). **Not folded into `unitCodes`**, which is what the *standard* admits — ' +
      '`measurementGuidance` reaches no monetary element, so an empty list there is EFRAG saying ' +
      'nothing, and a currency in it would make that measurement false. One per filing, as EFRAG’s ' +
      'own template carries it.',
  })
  readonly currency: string | null;

  @ApiProperty({ enum: STATES })
  readonly state: DisclosureState;

  @ApiProperty({ nullable: true, type: String })
  readonly notAvailableReason: string | null;

  @ApiProperty({ description: 'Carried forward from the prior period, and marked for review.' })
  readonly carriedForward: boolean;

  @ApiProperty({
    description:
      'Whether this field applies to this reporter (FR-28). False does not mean empty: a value ' +
      'entered before the condition turned is retained and served as stored (UX-28), so a ' +
      'retained answer is applicable false beside a state that is not missing.',
  })
  readonly applicable: boolean;

  @ApiProperty({
    nullable: true,
    type: ApplicabilityCauseDto,
    description: 'Why, for the fields a rule governs; null for the ones no rule names.',
  })
  readonly applicabilityCause: ApplicabilityCauseDto | null;

  constructor(field: DisclosureField) {
    this.elementKey = field.elementKey;
    this.dimensionKey = field.dimensionKey;
    this.ordinal = field.ordinal;
    this.kind = field.kind;
    this.periodType = field.periodType;
    this.dimensionLabel = field.dimensionLabel;
    this.origin = field.origin;
    this.axes = [...field.axes];
    this.repeating = field.repeating;
    this.order = field.order;
    this.label = field.label;
    this.labelStanding = field.labelStanding;
    this.help = field.help;
    this.options = field.options === null ? null : field.options.map((option) => new DisclosureOptionDto(option));
    this.defaultValue = field.defaultValue === null ? null : new DisclosureDefaultDto(field.defaultValue);
    this.valueNumeric = field.valueNumeric;
    this.valueText = field.valueText;
    this.valueBoolean = field.valueBoolean;
    this.valueDate = field.valueDate;
    this.unitCode = field.unitCode;
    this.unitCodes = [...field.unitCodes];
    this.currency = field.currency;
    this.state = field.state;
    this.notAvailableReason = field.notAvailableReason;
    this.carriedForward = field.carriedForward;
    this.applicable = field.applicable;
    this.applicabilityCause =
      field.applicabilityCause === null ? null : new ApplicabilityCauseDto(field.applicabilityCause);
  }
}

/**
 * One classification axis and the rows a reporter may add from it (task 36.5).
 *
 * Declared above `DisclosureStepDto` because Swagger resolves `type:` by reference at decoration
 * time, and a class used before its declaration is `undefined` there — the schema then emits as an
 * empty object with nothing failing.
 */
export class DisclosureAxisDto {
  @ApiProperty({ example: 'TypeOfPollutantAxis' })
  readonly key: string;

  @ApiProperty({
    nullable: true,
    type: String,
    description:
      "What to call the axis on screen — its default member's label, which is the domain's own " +
      'name. Null where the pinned version words no label for it in this locale.',
  })
  readonly label: string | null;

  @ApiProperty({
    type: [DisclosureOptionDto],
    description:
      'Every member the reporter may report along — the domain’s LEAVES. The default member is ' +
      'excluded because it is the domain’s root, and a member with children is excluded because a ' +
      'category is not a valid answer: EFRAG’s own workbook instructs a reporter to select a type ' +
      'of waste rather than a category. A flat domain is unaffected.',
  })
  readonly members: DisclosureOptionDto[];

  @ApiProperty({
    nullable: true,
    enum: [...LOCALES],
    description:
      'The language the member names are actually in, where that is NOT the requested locale — ' +
      'null otherwise, which is the ordinary answer. EFRAG publishes the EU List of Waste in ' +
      'English alone, so B7’s picker answers "en" for a Romanian or Russian reader and the screen ' +
      'says so. Distinct from a label’s standing, which is about whose words these are: these are ' +
      'EFRAG’s own, in a language the reader did not ask for. **Derived from LOCALES rather than ' +
      'typed as a string** so a client names the language rather than asserting one.',
  })
  readonly memberLanguage: Locale | null;

  constructor(axis: DisclosureAxis) {
    this.key = axis.key;
    this.label = axis.label;
    this.members = axis.members.map((member) => new DisclosureOptionDto(member));
    this.memberLanguage = axis.memberLanguage;
  }
}

export class DerivationInputDto {
  @ApiProperty({
    example: 'HoursWorkedByOneFullTimeEmployee',
    description:
      'The input’s key. **The browser names it from this**, because EFRAG words these in the ' +
      'Digital Template and not in the taxonomy — there is no locale in which the package carries ' +
      'a label, so a `label` here would be null in all three forever (task 36.10).',
  })
  readonly key: string;

  @ApiProperty({
    example: 'RateOfRecordableWorkRelatedAccidentsInTheReportingPeriod',
    description: 'The derived element this feeds, so a screen can show the input beside the figure.',
  })
  readonly derives: string;

  @ApiProperty({
    nullable: true,
    type: String,
    description: 'What the reporter stored, as a decimal string; null where they answered nothing.',
  })
  readonly value: string | null;

  @ApiProperty({
    nullable: true,
    type: String,
    example: '2000',
    description:
      'What the platform offers where they have not — EFRAG’s published default. Distinct from ' +
      '`value` on purpose: an offer accepted without editing is still an offer, and writing it on ' +
      'the reporter’s behalf would put a number they never chose into a filing.',
  })
  readonly offered: string | null;

  constructor(input: DerivationInputField) {
    this.key = input.key;
    this.derives = input.derives;
    this.value = input.value;
    this.offered = input.offered;
  }
}

export class DisclosureStepDto {
  @ApiProperty({ example: 'B8' })
  readonly module: string;

  @ApiProperty({
    example: '2026-05-01',
    description: "The report's own pinned version, which is what these fields were resolved from.",
  })
  readonly taxonomyVersion: string;

  @ApiProperty({ type: [DisclosureFieldDto] })
  readonly fields: DisclosureFieldDto[];

  @ApiProperty({
    type: [DisclosureAxisDto],
    description:
      'The domains this step’s classifications draw their rows from (UC-22). On the step rather ' +
      'than on each field, because every element on an axis shares one list — B4’s three ' +
      'emissions share 94 pollutants and B7’s waste elements share 973, so a per-field copy is ' +
      'the same answer hundreds of times. Empty for a step with no classification.',
  })
  readonly axes: DisclosureAxisDto[];

  @ApiProperty({
    type: [DerivationInputDto],
    description:
      'The values this step’s derived figures are computed from (UC-26, UC-27). **Not fields**: ' +
      'they carry no state, unit, dimension or applicability and are not exported as facts, so ' +
      'they are a separate list rather than fields a consumer must remember to exclude. Empty for ' +
      'every module the template computes no figure for.',
  })
  readonly derivationInputs: DerivationInputDto[];

  constructor(step: DisclosureStep) {
    this.module = step.module;
    this.taxonomyVersion = step.taxonomyVersion;
    this.fields = step.fields.map((field) => new DisclosureFieldDto(field));
    this.axes = step.axes.map((axis) => new DisclosureAxisDto(axis));
    this.derivationInputs = step.derivationInputs.map((input) => new DerivationInputDto(input));
  }
}

/** One field's new contents, addressed by the natural key §7.3 gives a value. */
export class DisclosureValueWriteDto {
  @ApiProperty({ example: 'NumberOfEmployees' })
  @IsString()
  @MaxLength(255)
  elementKey!: string;

  @ApiPropertyOptional({ description: 'An axis member; omit for an undimensioned element.' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  dimensionKey?: string;

  @ApiPropertyOptional({ description: 'Position within a repeating group.' })
  @IsOptional()
  @IsInt()
  @Min(0)
  ordinal?: number;

  @ApiPropertyOptional({ type: String, description: DECIMAL_AS_STRING })
  @IsOptional()
  @IsString()
  valueNumeric?: string | null;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  valueText?: string | null;

  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @IsBoolean()
  valueBoolean?: boolean | null;

  @ApiPropertyOptional({ type: String, example: DATE_EXAMPLE })
  @IsOptional()
  @IsISO8601({ strict: true })
  valueDate?: string | null;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  unitCode?: string | null;

  @ApiProperty({ enum: STATES })
  @IsIn(STATES)
  state!: DisclosureState;

  @ApiPropertyOptional({
    type: String,
    description: 'Required exactly when the state is not available (FR-32) — enforced by the store.',
  })
  @IsOptional()
  @IsString()
  notAvailableReason?: string | null;

  @ApiPropertyOptional({ description: 'FR-47: this value was carried forward from the prior period.' })
  @IsOptional()
  @IsBoolean()
  carriedForward?: boolean;
}

export class WriteDisclosureValuesRequestDto {
  @ApiProperty({
    type: [DisclosureValueWriteDto],
    description:
      'One field on blur, or everything a step change or an offline queue accumulated (FR-37, ' +
      'FR-38). The write is an upsert on the natural key, so a retried queue does not double-write.',
  })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(MAX_VALUES_PER_WRITE)
  @ValidateNested({ each: true })
  @Type(() => DisclosureValueWriteDto)
  values!: DisclosureValueWriteDto[];
}

/** What was durably committed — UX-36 acknowledges the commit, never optimistic local state. */
export class DisclosureValueResponseDto {
  @ApiProperty({ format: 'uuid' })
  readonly id: string;

  @ApiProperty()
  readonly elementKey: string;

  @ApiProperty()
  readonly dimensionKey: string;

  @ApiProperty()
  readonly ordinal: number;

  @ApiProperty({ nullable: true, type: String })
  readonly valueNumeric: string | null;

  @ApiProperty({ nullable: true, type: String })
  readonly valueText: string | null;

  @ApiProperty({ nullable: true, type: Boolean })
  readonly valueBoolean: boolean | null;

  @ApiProperty({ nullable: true, type: String })
  readonly valueDate: string | null;

  @ApiProperty({ nullable: true, type: String })
  readonly unitCode: string | null;

  @ApiProperty({ enum: STATES })
  readonly state: DisclosureState;

  @ApiProperty({ nullable: true, type: String })
  readonly notAvailableReason: string | null;

  @ApiProperty()
  readonly carriedForward: boolean;

  @ApiProperty({ type: Number, description: 'Unix epoch milliseconds, UTC.' })
  readonly updatedAt: EpochMillis;

  constructor(value: DisclosureValue) {
    this.id = value.id;
    this.elementKey = value.elementKey;
    this.dimensionKey = value.dimensionKey;
    this.ordinal = value.ordinal;
    this.valueNumeric = value.valueNumeric;
    this.valueText = value.valueText;
    this.valueBoolean = value.valueBoolean;
    this.valueDate = value.valueDate;
    this.unitCode = value.unitCode;
    this.state = value.state;
    this.notAvailableReason = value.notAvailableReason;
    this.carriedForward = value.carriedForward;
    this.updatedAt = value.updatedAt;
  }
}

/** One derivation input's new value (task 36.10). */
export class DerivationInputWriteDto {
  @ApiProperty({ example: 'HoursWorkedByOneFullTimeEmployee' })
  @IsString()
  @MaxLength(255)
  inputKey!: string;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: '1800',
    description:
      'A decimal string. **Omit or send null to clear**, which restores the published offer — a ' +
      'stored zero would instead make the rate undefined, a zero denominator being no answer ' +
      'rather than a working year of no hours.',
  })
  @IsOptional()
  @IsNumberString()
  valueNumeric?: string | null;
}

export class WriteDerivationInputsRequestDto {
  @ApiProperty({ type: [DerivationInputWriteDto] })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(MAX_VALUES_PER_WRITE)
  @ValidateNested({ each: true })
  @Type(() => DerivationInputWriteDto)
  values!: DerivationInputWriteDto[];
}
