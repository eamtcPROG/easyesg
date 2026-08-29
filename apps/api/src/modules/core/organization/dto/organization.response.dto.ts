import { ApiProperty } from '@nestjs/swagger';
import type { Organization, OrganizationChangeAttribution } from '../models/organization.model';

/**
 * The organization as UC-49 returns it and UC-50 renders it (FR-13, FR-15).
 *
 * Instants are epoch-millisecond integers, converted here — the persistence-to-DTO boundary is the
 * one place that conversion happens (§6.8, OQ-50). OpenAPI can only describe them as `integer`, so
 * the unit is stated in each `@ApiProperty` because nothing else will.
 *
 * **The address is flat, mirroring the model and the audit trail.** `core.field_change` records one
 * row per column that moved, so S-15's change history names `registered_locality`; nesting the
 * address on the wire would give one organization two vocabularies and a mapping between them.
 *
 * **`legalForm` is a key, not a label.** OQ-43 puts the wording in the committed catalogues, so the
 * front end resolves `srl` to *Societate cu Răspundere Limitată*. Sending the label instead would
 * make this endpoint a translation surface and pin the language at the moment of the read.
 */
/**
 * FR-15's *attributed and timestamped*, as one object rather than two loose fields.
 *
 * **Together or not at all.** An actor with no moment says nothing a reader can act on, and a
 * moment with no actor is what the screen renders when the person is unknowable — so the pair is
 * nullable as a unit and only `email` is nullable within it.
 *
 * `accountId` travels beside the address because the address is *display* and the id is *identity*:
 * task 84's S-12 links a trail entry to the person, and matching on an address is how that breaks
 * the first time someone changes theirs.
 */
export class OrganizationChangeAttributionDto {
  @ApiProperty({
    type: String,
    format: 'uuid',
    nullable: true,
    description: 'The acting account, or null where the change was not made by one.',
  })
  accountId: string | null;

  @ApiProperty({
    type: String,
    format: 'email',
    nullable: true,
    description:
      'The acting account’s address, for display. Null where that account no longer exists — the ' +
      'trail deliberately carries no foreign key, so an attribution outlives the account it names ' +
      '(NFR-28). There is no display name to show instead: registration collects none.',
  })
  email: string | null;

  @ApiProperty({ type: Number, description: 'Unix epoch milliseconds of the change.' })
  at: number;

  constructor(attribution: OrganizationChangeAttribution) {
    this.accountId = attribution.accountId;
    this.email = attribution.email;
    this.at = attribution.at.getTime();
  }
}

export class OrganizationResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ description: 'The registered legal name.' })
  name: string;

  @ApiProperty({ example: 'MD', description: 'ISO 3166-1 alpha-2, upper case.' })
  countryCode: string;

  @ApiProperty({
    type: String,
    nullable: true,
    description:
      'A key from the vocabulary registered for countryCode, or null where none is recorded yet — ' +
      'S-04 does not collect it. Resolve it to a label through the message catalogue; it is never ' +
      'a sentence.',
  })
  legalForm: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    example: '1003600158022',
    description: 'FR-16’s primary identifier, or null until S-15 records it — S-04 collects none.',
  })
  idno: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    example: '7LTWFZYICNSX8D621K86',
    description:
      'The Legal Entity Identifier, or null. Optional by OQ-18: few Moldovan SMEs hold one, and ' +
      'it is kept so B1 stays conformant for the readers who require it.',
  })
  lei: string | null;

  @ApiProperty({ type: String, nullable: true })
  registeredAddressLine1: string | null;

  @ApiProperty({ type: String, nullable: true })
  registeredAddressLine2: string | null;

  @ApiProperty({ type: String, nullable: true })
  registeredLocality: string | null;

  @ApiProperty({ type: String, nullable: true })
  registeredPostalCode: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    format: 'email',
    description:
      'How the PLATFORM reaches this organization. Distinct from reportContactEmail, which is ' +
      'printed on the report cover for its readers.',
  })
  contactEmail: string | null;

  @ApiProperty({ type: String, nullable: true })
  contactPhone: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    description:
      'FR-15’s report-cover contact — the person a reader of the published report contacts about ' +
      'its content. A second contact rather than a rename of contactEmail: in an SME the account ' +
      'administrator and the person who answers a question about a figure in B3 are routinely ' +
      'different people. Collected on S-15 only; S-04 sets neither.',
  })
  reportContactName: string | null;

  @ApiProperty({ type: String, nullable: true, format: 'email' })
  reportContactEmail: string | null;

  @ApiProperty({
    type: OrganizationChangeAttributionDto,
    nullable: true,
    description:
      'Who last changed any field of this record, and when (FR-15). Read from the per-field audit ' +
      'trail the database writes, not from a column the application maintains. Null where the ' +
      'trail holds nothing for this record — an unusual state, and a real answer rather than an ' +
      'error.',
  })
  lastChange: OrganizationChangeAttributionDto | null;

  @ApiProperty({ type: Number, description: 'Unix epoch milliseconds when the organization was created.' })
  createdAt: number;

  @ApiProperty({ type: Number, description: 'Unix epoch milliseconds of the last profile change.' })
  updatedAt: number;

  constructor(organization: Organization) {
    this.id = organization.id;
    this.name = organization.name;
    this.countryCode = organization.countryCode;
    this.legalForm = organization.legalForm;
    this.idno = organization.idno;
    this.lei = organization.lei;
    this.registeredAddressLine1 = organization.registeredAddressLine1;
    this.registeredAddressLine2 = organization.registeredAddressLine2;
    this.registeredLocality = organization.registeredLocality;
    this.registeredPostalCode = organization.registeredPostalCode;
    this.contactEmail = organization.contactEmail;
    this.contactPhone = organization.contactPhone;
    this.reportContactName = organization.reportContactName;
    this.reportContactEmail = organization.reportContactEmail;
    this.lastChange =
      organization.lastChange === null
        ? null
        : new OrganizationChangeAttributionDto(organization.lastChange);
    this.createdAt = organization.createdAt.getTime();
    this.updatedAt = organization.updatedAt.getTime();
  }
}
