import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, Length, Matches, ValidateIf } from 'class-validator';
import { Trim } from '@api/app/decorators/trim.decorator';

/**
 * UC-50's body — FR-15's profile, as a **patch** (S-15).
 *
 * **Absent and `null` are different requests, and the DTO has to keep them apart.** A field the
 * caller omits is unchanged; `null` clears it. `@IsOptional()` alone cannot express that — it skips
 * validation for `null` *and* `undefined`, which is right, but the use case then has to distinguish
 * them itself, which it does with `!== undefined`. `@ValidateIf(v => v !== null)` is what keeps
 * `null` from being validated as an email or a length while still arriving as a value.
 *
 * `name` and `countryCode` are the two that cannot be cleared: an organization with no name is not
 * a record anybody can act on, and no country means no legal-form vocabulary at all.
 */
export class UpdateOrganizationProfileRequestDto {
  @ApiPropertyOptional({ maxLength: 200, description: 'The registered legal name (FR-15).' })
  @Trim()
  @IsOptional()
  @IsString()
  @Length(1, 200)
  name?: string;

  @ApiPropertyOptional({
    example: 'MD',
    description:
      'ISO 3166-1 alpha-2. Changing it re-checks the stored legal form against the new country’s ' +
      'vocabulary, so a move that would strand the form is refused with problem type ' +
      'legal-form-unknown rather than silently leaving a value no list contains.',
  })
  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z]{2}$/u)
  countryCode?: string;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description:
      'A key from the vocabulary registered for the organization’s country — see GET ' +
      '/organizations/legal-forms. Null clears it, which is always permitted: an organization ' +
      'that has not decided is a state S-15 must be able to return to.',
  })
  @Trim()
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @Length(1, 40)
  legalForm?: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: '1003600158022',
    description:
      'FR-16’s primary identifier — Moldova’s thirteen-digit state identification number. Its ' +
      'shape is validated on entry; the thirteenth digit is a check digit whose algorithm is not ' +
      'published in the defining instrument, so it is not yet verified. Null clears it.',
  })
  @Trim()
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @Length(1, 13)
  idno?: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: '7LTWFZYICNSX8D621K86',
    description:
      'FR-16’s optional additional identifier — the Legal Entity Identifier (ISO 17442), upper ' +
      'case. Both its shape and its ISO 7064 MOD 97-10 check digits are verified, and the two ' +
      'refuse with different problem types because they have different resolutions. Null clears it.',
  })
  @Trim()
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @Length(1, 20)
  lei?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 200 })
  @Trim()
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @Length(1, 200)
  registeredAddressLine1?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 200 })
  @Trim()
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @Length(1, 200)
  registeredAddressLine2?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 120, description: 'City, town or village.' })
  @Trim()
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @Length(1, 120)
  registeredLocality?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 20 })
  @Trim()
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @Length(1, 20)
  registeredPostalCode?: string | null;

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

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    maxLength: 200,
    description:
      'FR-15’s report-cover contact — the person a reader of the published report contacts about ' +
      'its content, printed on the cover. A second contact rather than a rename of contactEmail, ' +
      'which is how the platform reaches the organization. Null clears it.',
  })
  @Trim()
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @Length(1, 200)
  reportContactName?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, format: 'email', maxLength: 320 })
  @Trim()
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsEmail()
  @Length(1, 320)
  reportContactEmail?: string | null;
}
