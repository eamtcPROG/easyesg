import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsObject, IsString, MaxLength, MinLength, ValidateNested } from 'class-validator';
import { ACCEPTED_LEGAL_DOCUMENTS, type AcceptedLegalDocument, type LegalVersions } from '@easyesg/i18n';
import type { OwedLegalDocument } from '../models/legal-acceptance.model';

/**
 * The legal documents' wire objects (task 195; §12.5.6's task-195 row): the versions a page displayed, which
 * registration and S-43 send, and what S-43 reads an account owes. One file because they are one vocabulary.
 *
 * **Bounded, not judged.** Whether a version is the one in force is the release's and the use case's to say — answered
 * `legal-version-changed` in three parts — so here a version is only a short string, as the column's `CHECK` bounds it.
 */
const VERSION_BOUNDS = { minLength: 1, maxLength: 32 } as const;

export class LegalVersionsDto implements LegalVersions {
  @ApiProperty({ ...VERSION_BOUNDS, example: '1.0', description: 'The version of the terms of service displayed.' })
  @IsString()
  @MinLength(VERSION_BOUNDS.minLength)
  @MaxLength(VERSION_BOUNDS.maxLength)
  terms!: string;

  @ApiProperty({ ...VERSION_BOUNDS, example: '1.0', description: 'The version of the privacy notice displayed.' })
  @IsString()
  @MinLength(VERSION_BOUNDS.minLength)
  @MaxLength(VERSION_BOUNDS.maxLength)
  privacy!: string;
}

/** `POST /account/legal-acceptance` — S-43's *Continue*, once its checkbox is ticked. */
export class AcceptLegalDocumentsRequestDto {
  @ApiProperty({
    type: LegalVersionsDto,
    description:
      'The versions the page displayed. Refused unless both are the versions in force — a page read before a release ' +
      'replaced either text is reloaded rather than recorded.',
  })
  @IsObject()
  @ValidateNested()
  @Type(() => LegalVersionsDto)
  legalVersions!: LegalVersionsDto;
}

/** A document the signed-in account owes an acceptance of. */
export class OwedLegalDocumentDto {
  @ApiProperty({ enum: [...ACCEPTED_LEGAL_DOCUMENTS] })
  readonly document: AcceptedLegalDocument;

  @ApiProperty({ example: '1.0', description: 'The version in force, the one to accept.' })
  readonly version: string;

  @ApiProperty({
    type: String,
    nullable: true,
    example: null,
    description: 'The version this account last accepted, or null where it has accepted none.',
  })
  readonly acceptedVersion: string | null;

  constructor(owed: OwedLegalDocument) {
    this.document = owed.document;
    this.version = owed.version;
    this.acceptedVersion = owed.acceptedVersion;
  }
}

/** `GET /account/legal-acceptance` — what S-43 asks the reader to accept. Empty once nothing is owed. */
export class LegalAcceptanceResponseDto {
  @ApiProperty({ type: [OwedLegalDocumentDto] })
  readonly owed: OwedLegalDocumentDto[];

  constructor(owed: readonly OwedLegalDocument[]) {
    this.owed = owed.map((document) => new OwedLegalDocumentDto(document));
  }
}
