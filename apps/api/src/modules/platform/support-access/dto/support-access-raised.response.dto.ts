import { ApiProperty } from '@nestjs/swagger';
import type { EpochMillis } from '@api/contracts/types/time';
import type { RaisedSupportAccessRequest } from '../use-cases/raise-support-access-request.use-case';

/** A request just raised (task 67.9) — waiting for the organization, which has 24 hours to answer. */
export class SupportAccessRaisedResponseDto {
  @ApiProperty({ format: 'uuid' })
  readonly id: string;

  @ApiProperty({ format: 'uuid' })
  readonly organizationId: string;

  @ApiProperty({ type: Number, description: 'Unix epoch milliseconds when the request was raised.' })
  readonly requestedAt: EpochMillis;

  @ApiProperty({
    type: Number,
    description: 'Unix epoch milliseconds when the request stops waiting if nobody answers it — 24 hours on.',
  })
  readonly lapsesAt: EpochMillis;

  constructor(raised: RaisedSupportAccessRequest) {
    this.id = raised.id;
    this.organizationId = raised.organizationId;
    this.requestedAt = raised.requestedAt.getTime();
    this.lapsesAt = raised.lapsesAt.getTime();
  }
}
