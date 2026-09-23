import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiObjectResponse } from '@api/app/decorators/api-envelope.decorator';
import { Public } from '@api/app/decorators/public.decorator';
import { UnsubscribeResponseDto, UnsubscribeTokenRequestDto } from '../dto/unsubscribe.dto';
import { NotificationUnsubscribeService } from '../services/notification-unsubscribe.service';

/**
 * `/api/v1/account/notification-preferences/unsubscribe` — FR-169's one-click unsubscribe (task 52.2.2; UC-173;
 * §12.5.6's task-52.2 row (2)), behind S-38 and its RFC 8058 route handler.
 *
 * **Public, and the token is why that is safe**: an optional email's reader is usually signed out, and one click is
 * FR-169's word. The signed token names the one account, category and channel it can switch off, and nothing else is
 * reachable from it — no read of anyone's preferences, no switch back on. On the account's prefix beside the
 * preferences it writes, not a second resource.
 *
 * **Two calls, because a link is followed by more than people**: `preview` changes nothing, so the scanners that
 * prefetch a message's links stop there; the switch is an explicit `POST` from S-38's button or from a mail client.
 *
 * **No `@RequiresEntitlement`**, the preferences' reason: no plan decides whether a person may stop an email, and a
 * public route has no organization whose plan could be asked.
 */
@ApiTags('platform')
@Controller('account/notification-preferences/unsubscribe')
@Public()
export class NotificationUnsubscribeController {
  constructor(private readonly unsubscribe: NotificationUnsubscribeService) {}

  @Post('preview')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Read what an unsubscribe link would switch off, without switching it',
    description:
      'The link’s standing and the category it is about. Changes nothing, so a link opened by a mail scanner ' +
      'unsubscribes nobody.',
  })
  @ApiObjectResponse(UnsubscribeResponseDto, { status: 200, description: 'What the link can do.' })
  async preview(@Body() body: UnsubscribeTokenRequestDto): Promise<UnsubscribeResponseDto> {
    return new UnsubscribeResponseDto(await this.unsubscribe.preview(body));
  }

  @Post()
  @HttpCode(200)
  @ApiOperation({
    summary: 'Stop one optional category’s email, as the unsubscribe link names it',
    description:
      'Switches the link’s category off by email for the person it was sent to, and changes nothing else. Pressing ' +
      'again is not an error. The person can switch it back on from their profile.',
  })
  @ApiObjectResponse(UnsubscribeResponseDto, { status: 200, description: 'Switched off.' })
  @ApiResponse({
    status: 400,
    description:
      'The link can switch nothing off — it was not issued by this platform, or its category may no longer be ' +
      'switched off (problem type validation-failed). Nothing changed.',
    content: { 'application/problem+json': {} },
  })
  async switchOff(@Body() body: UnsubscribeTokenRequestDto): Promise<UnsubscribeResponseDto> {
    return new UnsubscribeResponseDto(await this.unsubscribe.switchOff(body));
  }
}
