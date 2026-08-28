import { ApiProperty } from '@nestjs/swagger';
import type { CountryLegalForms } from '../use-cases/list-legal-forms.use-case';

/**
 * One country the platform operates in, and the legal forms registered for it (FR-15, AD-4).
 *
 * **The list is configuration, so this contract describes a shape and never the values.** Naming
 * `srl` in an `enum` here would publish as a fixed set the one thing AD-4 exists to keep moving,
 * and `openapi:check` would then fail the day an operator registers a form — turning a
 * no-redeploy change into a release.
 */
export class CountryLegalFormsResponseDto {
  @ApiProperty({ example: 'MD', description: 'ISO 3166-1 alpha-2, upper case. An organization may be created in this country.' })
  countryCode: string;

  @ApiProperty({
    type: [String],
    description:
      'Legal-form keys, in the order they are registered. Each resolves to a label through the ' +
      'message catalogue (OQ-43), so a form registered ahead of its wording renders its key.',
  })
  legalForms: string[];

  constructor(entry: CountryLegalForms) {
    this.countryCode = entry.countryCode;
    this.legalForms = [...entry.legalForms];
  }
}
