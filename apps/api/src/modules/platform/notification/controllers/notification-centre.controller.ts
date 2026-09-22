import { Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Req, UseInterceptors } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { DEFAULT_ON_PAGE } from '@api/app/constants/pagination.constants';
import { ApiListResponse, ApiObjectResponse } from '@api/app/decorators/api-envelope.decorator';
import { RequestListDto } from '@api/app/dto/request-list.dto';
import { ResultListDto } from '@api/app/dto/result-list.dto';
import { NO_CONTENT_RESPONSE } from '@api/app/interceptors/global-response.interceptor';
import { ListQueryInterceptor } from '@api/app/interceptors/list-query.interceptor';
import { NOTIFICATION_CATEGORY } from '@api/contracts/notification.port';
import { RequiresRole } from '@api/modules/identity/membership/decorators/requires-role.decorator';
import { MEMBERSHIP_ROLE } from '@api/modules/identity/membership/models/membership.model';
import { NotificationItemResponseDto } from '../dto/notification-item.response.dto';
import { UnreadCountResponseDto } from '../dto/unread-count.response.dto';
import { NOTIFICATION_READ_STATE } from '../models/notification-centre.model';
import { NotificationCentreService } from '../services/notification-centre.service';

const PROBLEM = { 'application/problem+json': {} };
const NOTIFICATION_ID = 'notificationId';

const NOT_FOUND = {
  status: 404,
  description:
    'The caller holds no notice with this id in the active organization — including one addressed to a colleague, ' +
    'which is not distinguished from one that does not exist (problem type not-found).',
  content: PROBLEM,
} as const;

/**
 * `/api/v1/notifications` — the recipient's notification centre (task 50.1.2; UC-165 … UC-167; FR-161, FR-162;
 * §12.5.6's task-50.1 rows (8) … (11)).
 *
 * **A tenant route, and every member's**: the organization is the session's, as for `/members`, and the recipient
 * is the signed-in account — no parameter names either, and the database answers only their rows (BR-NOT-5). A
 * member of any role has a centre.
 *
 * **The writes are the recipient's own read state**, so they carry no audit action and no field-change trail: a
 * read marker records presence, and the delivery row it lands on is itself FR-170's evidence.
 *
 * **Neither read nor write carries `@RequiresEntitlement`, and none needs a key**: no plan gates a person being told
 * what the system needs them to know.
 */
@ApiTags('platform')
@Controller('notifications')
@RequiresRole(MEMBERSHIP_ROLE.ORGANIZATION_ADMINISTRATOR, MEMBERSHIP_ROLE.EDITOR, MEMBERSHIP_ROLE.VIEWER)
export class NotificationCentreController {
  constructor(private readonly centre: NotificationCentreService) {}

  @Get()
  // An instance, not the class: see `AccessController` for what the class does to the application's boot.
  @UseInterceptors(new ListQueryInterceptor())
  @ApiOperation({
    summary: 'List the caller’s notifications in the active organization',
    description:
      'The notices addressed to the caller that are still in their centre — not dismissed, not withdrawn — each ' +
      'with its title and text in the negotiated language and a link to what raised it. Read state is the ' +
      'caller’s own: a colleague reading the same notice leaves it unread here.',
  })
  @ApiQuery({
    name: 'filters',
    required: false,
    description:
      `Compact facets, pipe-separated: \`read,<${Object.values(NOTIFICATION_READ_STATE).join('|')}>\` and ` +
      `\`category,<key>[,<key>…]\` over ${Object.values(NOTIFICATION_CATEGORY).join(', ')}. A value outside ` +
      'these, or a field this route does not define, is ignored rather than refused.',
  })
  @ApiQuery({
    name: 'order',
    required: false,
    description: 'One ordering, `received,<asc|desc>`. Defaults to `received,desc` — newest first.',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, description: '1-based.' })
  @ApiQuery({
    name: 'onpage',
    required: false,
    type: Number,
    description: `Notices per page, ${DEFAULT_ON_PAGE} unless given. \`-1\` (all rows) is refused on this route.`,
  })
  @ApiListResponse(NotificationItemResponseDto, {
    status: 200,
    description:
      'One page of the centre. `total` counts notices the facets admit and is what pages are counted from; ' +
      '`unfiltered` counts the centre before them, which tells an empty page whether nothing has arrived yet or ' +
      'the facets matched nothing.',
  })
  async list(@Req() request: Request): Promise<ResultListDto<NotificationItemResponseDto>> {
    // `AccessController`'s guard: the interceptor always sets this, and a route that lost it serves one page.
    const query = this.centre.narrow(request.requestList ?? new RequestListDto());
    const page = await this.centre.list(query);

    return new ResultListDto({
      objects: page.items.map((item) => new NotificationItemResponseDto(item)),
      total: page.matched,
      totalpages: Math.max(1, Math.ceil(page.matched / query.take)),
      unfiltered: page.total,
    });
  }

  @Get('unread-count')
  @ApiOperation({
    summary: 'How many of the caller’s notifications are unread',
    description:
      'The count the global tier shows on every screen. Dismissed and withdrawn notices are not counted, and a ' +
      'colleague’s reading changes nothing here.',
  })
  @ApiObjectResponse(UnreadCountResponseDto, { status: 200, description: 'The unread count.' })
  async unreadCount(): Promise<UnreadCountResponseDto> {
    return new UnreadCountResponseDto(await this.centre.unreadCount());
  }

  @Post(`:${NOTIFICATION_ID}/read`)
  @HttpCode(204)
  @ApiOperation({
    summary: 'Mark a notification read, for the caller alone',
    description:
      'Records that the caller read it. Marking it again keeps the first time. Other recipients are unaffected.',
  })
  @ApiParam({ name: NOTIFICATION_ID, format: 'uuid' })
  @ApiResponse({ status: 204, description: 'Read.' })
  @ApiResponse(NOT_FOUND)
  async read(
    @Param(NOTIFICATION_ID, ParseUUIDPipe) notificationId: string,
  ): Promise<typeof NO_CONTENT_RESPONSE> {
    await this.centre.markRead({ notificationId });
    return NO_CONTENT_RESPONSE;
  }

  @Post(`:${NOTIFICATION_ID}/dismiss`)
  @HttpCode(204)
  @ApiOperation({
    summary: 'Dismiss a notification from the caller’s centre',
    description:
      'Takes it out of the caller’s list and unread count. Dismissing does not mark it read: one dismissed ' +
      'unopened stays recorded as never read. Dismissing it again changes nothing; other recipients are unaffected.',
  })
  @ApiParam({ name: NOTIFICATION_ID, format: 'uuid' })
  @ApiResponse({ status: 204, description: 'Dismissed.' })
  @ApiResponse(NOT_FOUND)
  async dismiss(
    @Param(NOTIFICATION_ID, ParseUUIDPipe) notificationId: string,
  ): Promise<typeof NO_CONTENT_RESPONSE> {
    await this.centre.dismiss({ notificationId });
    return NO_CONTENT_RESPONSE;
  }
}
