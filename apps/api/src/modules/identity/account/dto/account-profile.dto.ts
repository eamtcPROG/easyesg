import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { LOCALES, type Locale } from '@easyesg/i18n';
import { displayName, monogram } from '../domain/display-name';
import type { AccountProfile } from '../models/account-profile.model';

/**
 * S-27's profile on the wire (task 52.3; UC-13, UC-14; FR-9, FR-10, FR-52, FR-169) — one vocabulary: the Record
 * read, and the save that replaces it.
 */

export class SaveAccountProfileRequestDto {
  @ApiProperty({ example: 'Ana', minLength: 1, maxLength: 100 })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  givenName!: string;

  @ApiProperty({ example: 'Rusu', minLength: 1, maxLength: 100 })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  familyName!: string;

  @ApiProperty({
    type: String,
    required: false,
    nullable: true,
    maxLength: 100,
    example: 'Financial controller',
    description: 'Optional. Omitted, null or blank clears it.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  jobTitle?: string | null;

  @ApiProperty({
    type: String,
    required: false,
    nullable: true,
    maxLength: 32,
    example: '+373 69 123 456',
    description:
      'Optional, in international form — `+`, the country code and the number; spaces, dashes and brackets are ' +
      'accepted and not kept. Used only for support to reach the person about their account. Omitted, null or blank ' +
      'clears it.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  phone?: string | null;

  @ApiProperty({ enum: [...LOCALES], description: 'The interface’s language (FR-10).' })
  @IsIn([...LOCALES])
  locale!: Locale;

  @ApiProperty({ enum: [...LOCALES], description: 'The language every message to this person is written in (FR-169).' })
  @IsIn([...LOCALES])
  emailLocale!: Locale;

  @ApiProperty({
    enum: [...LOCALES],
    description: 'The language an export starts from; each export can choose another (FR-52).',
  })
  @IsIn([...LOCALES])
  exportLocale!: Locale;
}

export class AccountProfileResponseDto {
  @ApiProperty({
    description: 'The sign-in address, which is also where the platform writes to. Changed nowhere on this route.',
  })
  email: string;

  @ApiProperty({ type: String, nullable: true, description: 'Null for an account that has never given one.' })
  givenName: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Null for an account that has never given one.' })
  familyName: string | null;

  @ApiProperty({
    description:
      'The name every surface shows, derived from the two parts and never stored — the address where neither is given.',
  })
  displayName: string;

  @ApiProperty({ type: String, nullable: true, description: 'The initials beside it; null where no part is given.' })
  monogram: string | null;

  @ApiProperty({ type: String, nullable: true })
  jobTitle: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'International form, digits only after the `+`.' })
  phone: string | null;

  @ApiProperty({ enum: [...LOCALES] })
  locale: Locale;

  @ApiProperty({ enum: [...LOCALES] })
  emailLocale: Locale;

  @ApiProperty({ enum: [...LOCALES] })
  exportLocale: Locale;

  constructor(profile: AccountProfile) {
    this.email = profile.email;
    this.givenName = profile.givenName;
    this.familyName = profile.familyName;
    this.displayName = displayName(profile, profile.email);
    this.monogram = monogram(profile);
    this.jobTitle = profile.jobTitle;
    this.phone = profile.phone;
    this.locale = profile.locale;
    this.emailLocale = profile.emailLocale;
    this.exportLocale = profile.exportLocale;
  }
}
