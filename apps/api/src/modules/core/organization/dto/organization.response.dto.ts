import { ApiProperty } from '@nestjs/swagger';
import type { Organization } from '../models/organization.model';

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

  @ApiProperty({ type: String, nullable: true, format: 'email' })
  contactEmail: string | null;

  @ApiProperty({ type: String, nullable: true })
  contactPhone: string | null;

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
    this.createdAt = organization.createdAt.getTime();
    this.updatedAt = organization.updatedAt.getTime();
  }
}
