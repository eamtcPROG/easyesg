import { ApiProperty } from '@nestjs/swagger';
import type { Organization, OrganizationChangeAttribution } from '../models/organization.model';

/**
 * The organization as UC-49 returns it and UC-50 renders it (FR-13, FR-15).
 *
 * Instants are epoch-millisecond integers, converted here — the persistence-to-DTO boundary is the
 * one place that conversion happens (§6.8, OQ-50). OpenAPI can only describe them as `integer`, so
 * the unit is stated in each `@ApiProperty` because nothing else will.
 *
 * **The account, since task 177**: its name, country and platform contact. The legal form, the registered address
 * and the report-cover contact are each reporting entity's, on `ReportingEntityResponseDto`.
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

  @ApiProperty({ description: 'The organization’s name — the account’s, shown to its members.' })
  name: string;

  @ApiProperty({ example: 'MD', description: 'ISO 3166-1 alpha-2, upper case.' })
  countryCode: string;

  @ApiProperty({
    type: String,
    nullable: true,
    format: 'email',
    description:
      'How the PLATFORM reaches this organization. Never printed on a report: the contact a report ' +
      'names is each reporting entity’s (task 177).',
  })
  contactEmail: string | null;

  @ApiProperty({ type: String, nullable: true })
  contactPhone: string | null;

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
    this.contactEmail = organization.contactEmail;
    this.contactPhone = organization.contactPhone;
    this.lastChange =
      organization.lastChange === null
        ? null
        : new OrganizationChangeAttributionDto(organization.lastChange);
    this.createdAt = organization.createdAt.getTime();
    this.updatedAt = organization.updatedAt.getTime();
  }
}
