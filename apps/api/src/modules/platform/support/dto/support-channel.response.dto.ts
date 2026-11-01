import { ApiProperty } from '@nestjs/swagger';
import type { SupportChannel } from '../domain/support-channel';

/**
 * Support's mailbox as the help centre names it (task 227; `architecture.md` §12.5.6's task-227 row (4)) — the address
 * a request is delivered to, read with no session, since the help centre puts nothing behind the account (S-32).
 */
export class SupportChannelResponseDto {
  @ApiProperty({ format: 'email', example: 'ajutor@easyesg.md', description: 'The support mailbox in force.' })
  readonly address: string;

  constructor(channel: SupportChannel) {
    this.address = channel.address;
  }
}
