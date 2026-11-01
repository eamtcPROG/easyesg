import { Body, Controller, Get, Put } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiObjectResponse } from '@api/app/decorators/api-envelope.decorator';
import { RequiresAccount } from '@api/modules/identity/membership/decorators/requires-account.decorator';
import {
  NotificationPreferencesResponseDto,
  SetNotificationPreferencesRequestDto,
} from '../dto/notification-preferences.dto';
import { NotificationPreferencesService } from '../services/notification-preferences.service';

/**
 * `/api/v1/account/notification-preferences` — what reaches the signed-in person, and where (task 52.1; UC-168,
 * FR-9, FR-163; §12.5.6's task-52.1 row), behind S-27.
 *
 * **On the account's prefix, and this module's**: the answer is the same in every organization the person belongs to,
 * so it sits beside `/account/password` rather than beside the centre's tenant route, and needs no active membership —
 * while FR-163 is the notification module's, whose dispatch honours it (52.2). No account id in the path: the account is
 * the session's, as for every `/account/*` route.
 *
 * `PUT` because the write is the whole set of switch-offs, replacing the last, and repeating it changes nothing more.
 *
 * **No audit action and no field-change trail**: a preference is the person's own setting, as their password and
 * second factor are, and nothing here is another person's decision. **No `@RequiresEntitlement`**: no plan decides what
 * a person may be told.
 */
@ApiTags('platform')
@Controller('account/notification-preferences')
@RequiresAccount()
export class NotificationPreferencesController {
  constructor(private readonly preferences: NotificationPreferencesService) {}

  @Get()
  @ApiOperation({
    summary: 'Read what reaches the signed-in person, and where',
    description:
      'Every notification category the account can receive, each on the channels it travels on, switched on unless ' +
      'the person switched it off. Categories that may not be switched off are listed as mandatory and switched on.',
  })
  @ApiObjectResponse(NotificationPreferencesResponseDto, { status: 200, description: 'The preferences.' })
  async read(): Promise<NotificationPreferencesResponseDto> {
    return new NotificationPreferencesResponseDto(await this.preferences.read());
  }

  @Put()
  @ApiOperation({
    summary: 'Replace what the signed-in person has switched off',
    description:
      'Switches off exactly the pairs named, among those the read offers, and switches every other offered pair on. ' +
      'Answers the preferences as they now stand.',
  })
  @ApiObjectResponse(NotificationPreferencesResponseDto, { status: 200, description: 'The preferences, as saved.' })
  @ApiResponse({
    status: 400,
    description:
      'The body is malformed, or names a pair the read does not offer — a mandatory category, or a channel the ' +
      'category does not travel on (problem type validation-failed). Nothing was changed.',
    content: { 'application/problem+json': {} },
  })
  async replace(@Body() body: SetNotificationPreferencesRequestDto): Promise<NotificationPreferencesResponseDto> {
    return new NotificationPreferencesResponseDto(await this.preferences.set(body));
  }
}
