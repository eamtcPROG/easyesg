import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, Length, Matches, ValidateIf } from 'class-validator';
import { Trim } from '@api/app/decorators/trim.decorator';

/**
 * UC-50's body — FR-15's profile, as a **patch** (S-15): the account's name, country and platform contact, since task
 * 177 moved what a report prints to the reporting entity.
 *
 * **Absent and `null` are different requests, and the DTO has to keep them apart.** A field the
 * caller omits is unchanged; `null` clears it. `@IsOptional()` alone cannot express that — it skips
 * validation for `null` *and* `undefined`, which is right, but the use case then has to distinguish
 * them itself, which it does with `!== undefined`. `@ValidateIf(v => v !== null)` is what keeps
 * `null` from being validated as an email or a length while still arriving as a value.
 *
 * `name` and `countryCode` are the two that cannot be cleared: an organization with no name is not
 * a record anybody can act on, and no country means no vocabulary its entities could be held to.
 */
export class UpdateOrganizationProfileRequestDto {
  @ApiPropertyOptional({ maxLength: 200, description: 'The organization’s name — the account’s (FR-15).' })
  @Trim()
  @IsOptional()
  @IsString()
  @Length(1, 200)
  name?: string;

  @ApiPropertyOptional({
    example: 'MD',
    description:
      'ISO 3166-1 alpha-2 — the country whose legal-form and activity vocabularies the organization’s ' +
      'entities are held to. A country that registers none is refused (country-not-supported).',
  })
  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z]{2}$/u)
  countryCode?: string;

  @ApiPropertyOptional({ type: String, nullable: true, format: 'email', maxLength: 320 })
  @Trim()
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsEmail()
  @Length(1, 320)
  contactEmail?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 40 })
  @Trim()
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @Length(1, 40)
  contactPhone?: string | null;
}
