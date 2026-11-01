import { ApiProperty } from '@nestjs/swagger';

/**
 * The recipient's unread count in the active organization (UC-165; FR-161, UX-62; task 50.1.2) — what the global
 * tier shows on every screen, polled each minute (OQ-36).
 */
export class UnreadCountResponseDto {
  @ApiProperty({
    type: 'integer',
    minimum: 0,
    description: 'Notices in this recipient’s centre they have not read. A dismissed notice is not counted.',
    example: 3,
  })
  unread: number;

  constructor(count: { readonly unread: number }) {
    this.unread = count.unread;
  }
}
