import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, Length, Matches } from 'class-validator';
import { Trim } from '@api/app/decorators/trim.decorator';

/**
 * UC-49's body — S-04's three fields (FR-13).
 *
 * **The legal form and the registered address are deliberately absent.** S-04 collects the legal
 * name, the country and the contact details, and states that "the deeper fiscal and identifier
 * validation belongs to S-15 and S-23". A founding form that demanded the full profile would put
 * the registry lookup between a new user and their first screen.
 *
 * **The country is validated for shape here and for support in the use case**, and the split is
 * deliberate: whether `FR` is two letters is a property of the request, while whether the platform
 * operates in France is registered configuration that moves at runtime (AD-4). A `@IsIn` over the
 * registered countries would freeze at class-decoration time — before the store has ever polled.
 *
 * No custom `message`, matching every other request DTO here: `ProblemDetailsFilter` passes
 * field-level validation output through untranslated, addressed to the developer integrating
 * against the API.
 */
export class CreateOrganizationRequestDto {
  @ApiProperty({
    maxLength: 200,
    description: 'The registered legal name (FR-15). Propagates into every report the organization produces.',
  })
  @Trim()
  @IsString()
  @Length(1, 200)
  name!: string;

  @ApiProperty({
    example: 'MD',
    description:
      'ISO 3166-1 alpha-2, case-insensitive and stored upper case. It is not merely an address ' +
      'line: it selects the legal-form vocabulary, so a country the platform does not yet ' +
      'register one for is refused with problem type country-not-supported. GET ' +
      '/organizations/legal-forms is the list of countries this accepts.',
  })
  @IsString()
  @Matches(/^[A-Za-z]{2}$/u)
  countryCode!: string;

  @ApiPropertyOptional({
    format: 'email',
    maxLength: 320,
    description: 'Where the platform writes to about this organization. Distinct from the billing contact (FR-106).',
  })
  @Trim()
  @IsOptional()
  @IsEmail()
  @Length(1, 320)
  contactEmail?: string;

  @ApiPropertyOptional({
    maxLength: 40,
    description: 'Free-form, deliberately unvalidated beyond its length — there is no international format this could enforce without refusing real numbers.',
  })
  @Trim()
  @IsOptional()
  @IsString()
  @Length(1, 40)
  contactPhone?: string;
}
