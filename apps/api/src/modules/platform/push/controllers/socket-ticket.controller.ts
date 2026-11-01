import { Controller, HttpCode, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiObjectResponse } from '@api/app/decorators/api-envelope.decorator';
import { RequiresAccount } from '@api/modules/identity/membership/decorators/requires-account.decorator';
import { SocketTicketResponseDto } from '../dto/socket-ticket.dto';
import { SocketTicketService } from '../services/socket-ticket.service';

/**
 * `/api/v1/session/socket-ticket` — AD-15's handshake (task 147; §12.5.6's task-147 ticket row).
 *
 * **The path names what the ticket stands for: the session**, as `PUT /session/organization` does; it lives in
 * `platform/push`, which owns the socket, as that route lives in `identity/membership`. The browser reaches it through
 * `apps/web`'s pass-through, which attaches the session's bearer — so the ticket is minted by the session proxy the row
 * names, with no web code of its own. **A POST**, because each call mints a new ticket and none may be cached.
 *
 * **`@RequiresAccount`, not `@RequiresRole`**: the socket belongs to the account, and an account between organizations
 * still has a centre worth accelerating. **No entitlement gate, and none is owed**: a ticket spends nothing a plan
 * meters, and the reads a frame triggers are gated where they are.
 */
@ApiTags('identity')
@Controller('session/socket-ticket')
@RequiresAccount()
export class SocketTicketController {
  constructor(private readonly tickets: SocketTicketService) {}

  @Post()
  @HttpCode(201)
  @ApiOperation({
    summary: 'Mint a ticket to open the hint socket',
    description:
      'A single-use ticket, valid for thirty seconds, for opening the socket over which the platform hints that a ' +
      'screen’s data changed. It carries no personal data; the socket re-reads this session when it is presented.',
  })
  @ApiObjectResponse(SocketTicketResponseDto, { status: 201, description: 'The ticket and when it stops working.' })
  @ApiResponse({
    status: 401,
    description: 'No usable session (problem type authentication-required or session-expired).',
    content: { 'application/problem+json': {} },
  })
  async issue(): Promise<SocketTicketResponseDto> {
    return new SocketTicketResponseDto(await this.tickets.issue());
  }
}
