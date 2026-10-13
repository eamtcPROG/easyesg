import { ApiProperty } from '@nestjs/swagger';
import type { EpochMillis } from '@api/contracts/types/time';
import type { StoredLegalController } from '../models/legal-controller.model';

/**
 * The platform operator as A-21 shows it (task 75; FR-205): the four facts the legal documents state, the revision a
 * change is made against, and who last changed them.
 */
export class LegalControllerRecordResponseDto {
  @ApiProperty({ description: 'The operator’s name as registered; empty until one is published.' })
  readonly registeredName: string;

  @ApiProperty({ description: 'The operator’s IDNO; empty until one is published.' })
  readonly idno: string;

  @ApiProperty({ description: 'The operator’s registered address; empty until one is published.' })
  readonly registeredAddress: string;

  @ApiProperty({ description: 'Where questions about personal data are sent; empty until one is published.' })
  readonly dataProtectionEmail: string;

  @ApiProperty({
    type: Number,
    description:
      'The configuration revision in force, sent back with a change so that a newer one refuses it. 0 before ' +
      'anything was published.',
  })
  readonly revision: number;

  @ApiProperty({
    type: String,
    nullable: true,
    format: 'email',
    description: 'The operator who published the values in force. Null for the platform’s starting values.',
  })
  readonly changedByEmail: string | null;

  @ApiProperty({
    type: Number,
    nullable: true,
    description: 'Unix epoch milliseconds when the values in force were published.',
  })
  readonly changedAt: EpochMillis | null;

  constructor(stored: StoredLegalController) {
    this.registeredName = stored.controller.registeredName;
    this.idno = stored.controller.idno;
    this.registeredAddress = stored.controller.registeredAddress;
    this.dataProtectionEmail = stored.controller.dataProtectionEmail;
    this.revision = stored.revision;
    this.changedByEmail = stored.changedByEmail;
    this.changedAt = stored.changedAt === null ? null : stored.changedAt.getTime();
  }
}
