import { ApiProperty } from '@nestjs/swagger';
import type { LegalControllerPublication } from '../models/legal-controller.model';

/**
 * The configuration revision an A-21 save just put in force (task 75). **`id` is the configuration version's**, which
 * is what the system audit log's row names — the operator has no id of its own to name.
 */
export class LegalControllerPublicationResponseDto {
  @ApiProperty({ format: 'uuid', description: 'The configuration version now in force.' })
  readonly id: string;

  @ApiProperty({ type: Number, description: 'Its revision — what the next change is made against.' })
  readonly revision: number;

  constructor(publication: LegalControllerPublication) {
    this.id = publication.id;
    this.revision = publication.revision;
  }
}
