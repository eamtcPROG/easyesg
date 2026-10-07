import { ApiProperty } from '@nestjs/swagger';
import type { OverridingPerson } from '../models/disclosure-value.model';

/**
 * The person who replaced a computed figure, as the figure names them (task 39.4; FR-36, BR-CALC-3) — on a B3 scope's
 * field and on an invoice line's override alike, so the two read the same.
 */
export class OverridingPersonDto {
  @ApiProperty({ format: 'uuid', description: 'The account that made the override.' })
  readonly accountId: string;

  @ApiProperty({
    type: String,
    nullable: true,
    description:
      'Their display name as it reads now — given and family name, or the address where they gave none — or null where ' +
      'the account no longer exists.',
  })
  readonly name: string | null;

  constructor(person: OverridingPerson) {
    this.accountId = person.accountId;
    this.name = person.name;
  }
}
