import { ApiProperty } from '@nestjs/swagger';
import type { EpochMillis } from '@api/contracts/types/time';

/** A ticket to open AD-15's socket (task 147) — shown once, spent once, dead in thirty seconds. */
export class SocketTicketResponseDto {
  @ApiProperty({
    description:
      'Single-use and opaque; carries no personal data. Present it as the `ticket` query parameter of the socket ' +
      'upgrade within thirty seconds.',
  })
  readonly ticket: string;

  @ApiProperty({ type: 'integer', description: 'When the ticket stops working, unused. Unix epoch milliseconds, UTC.' })
  readonly expiresAt: EpochMillis;

  constructor(issued: { readonly ticket: string; readonly expiresAt: Date }) {
    this.ticket = issued.ticket;
    this.expiresAt = issued.expiresAt.getTime();
  }
}
