import { ApiProperty } from '@nestjs/swagger';
import type { SeatConsumption } from '../models/seat-consumption.model';

/**
 * S-16's seat region on the wire (task 142; UX-50, UX-52).
 *
 * **Two numbers and no plan.** No plan exists until task 53, so there is no plan name to publish and
 * no upgrade path to offer; what task 54.2 changes is where `allowance` comes from, and this shape
 * does not move when it does.
 */
export class SeatConsumptionResponseDto {
  @ApiProperty({
    type: Number,
    nullable: true,
    example: 10,
    description:
      'How many people the organization may have — active members and pending invitations ' +
      'together. Null when the ceiling cannot be read right now; inviting and accepting are ' +
      'refused while it is, and the count below is still true.',
  })
  allowance: number | null;

  @ApiProperty({
    type: Number,
    example: 4,
    description:
      'Seats held now: every active member plus every pending invitation, including invitations ' +
      'whose link has lapsed — they hold their seat until revoked. Equals the unfiltered total of ' +
      'GET /access, because it counts the same rows.',
  })
  used: number;

  constructor(consumption: SeatConsumption) {
    this.allowance = consumption.allowance;
    this.used = consumption.used;
  }
}
