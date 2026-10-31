import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiObjectResponse } from '@api/app/decorators/api-envelope.decorator';
import { Public } from '@api/app/decorators/public.decorator';
import { SupportChannelResponseDto } from '../dto/support-channel.response.dto';
import { SupportChannelService } from '../services/support-channel.service';

/**
 * `/api/v1/support/channel` — the support channel in force, as the help centre names it (task 227; FR-212 behaviour 9;
 * `architecture.md` §12.5.6's task-227 row (4)).
 *
 * **`@Public()`, the decorator's fourth kind**: what a reader is owed before an account exists. The help centre puts
 * nothing behind the account (S-32), and a visitor is shown where to write; it discloses only the mailbox the
 * platform publishes for that purpose.
 */
@ApiTags('support')
@Controller('support/channel')
@Public()
export class SupportChannelController {
  constructor(private readonly channel: SupportChannelService) {}

  @Get()
  @ApiOperation({
    summary: 'Read the support channel',
    description:
      'UC-180, UC-182. The support mailbox a request to support is delivered to. Changed without a deploy; a change is ' +
      'served within seconds.',
  })
  @ApiObjectResponse(SupportChannelResponseDto, { status: 200, description: 'The support channel in force.' })
  @ApiResponse({
    status: 503,
    description: 'No readable support address is in force (problem type support-channel-unavailable).',
    content: { 'application/problem+json': {} },
  })
  read(): SupportChannelResponseDto {
    return new SupportChannelResponseDto(this.channel.published());
  }
}
