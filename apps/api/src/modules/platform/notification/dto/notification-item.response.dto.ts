import { ApiProperty } from '@nestjs/swagger';
import { NOTIFICATION_CATEGORY } from '@api/contracts/notification.port';
import type { EpochMillis } from '@api/contracts/types/time';
import type { NotificationCentreItem } from '../models/notification-centre.model';

/**
 * One notice in the recipient's centre (UC-165, UC-166; FR-161, FR-162; task 50.1.2).
 *
 * **Words, not a template** (§12.5.6's task-50.1 row (10)): the title and body are resolved by the API in the
 * request's language from the category's in-app wording, so the notice's parameters stay server-side and the web
 * renders what it is given. Each is **absent** where the category has no in-app wording written, the problem
 * document's rule — never the key in its place. The category key is carried for the client to act on, never to show.
 *
 * Instants are epoch-millisecond integers, converted at this boundary and nowhere else (§6.8, OQ-50).
 */
export class NotificationItemResponseDto {
  @ApiProperty({
    format: 'uuid',
    description: 'The notice. The handle its read and dismiss actions take; the same for every recipient of it.',
  })
  id: string;

  @ApiProperty({
    enum: Object.values(NOTIFICATION_CATEGORY),
    description: 'What kind of notice this is — a key for the client to act on, never text to show.',
  })
  categoryKey: string;

  @ApiProperty({
    required: false,
    description: 'The notice’s title in the negotiated language. Absent when the category has no in-app wording.',
  })
  title?: string;

  @ApiProperty({
    required: false,
    description: 'The notice’s text in the negotiated language. Absent when the category has no in-app wording.',
  })
  body?: string;

  @ApiProperty({
    example: '/reports/0192f000-0000-7000-8000-000000000001',
    description:
      'The path in the tenant application of the object that raised the notice, without a locale prefix — ' +
      'selecting the notice opens it (FR-162).',
  })
  deepLink: string;

  @ApiProperty({
    type: 'integer',
    description: 'Unix epoch milliseconds, UTC, when the notice reached this recipient’s centre.',
    example: 1_790_553_600_000,
  })
  receivedAt: EpochMillis;

  @ApiProperty({
    type: 'integer',
    nullable: true,
    description:
      'Unix epoch milliseconds, UTC, when this recipient first marked it read. Null while unread; another ' +
      'recipient reading the same notice leaves it null here.',
    example: null,
  })
  readAt: EpochMillis | null;

  constructor(item: NotificationCentreItem) {
    this.id = item.notificationId;
    this.categoryKey = item.categoryKey;
    this.title = item.title;
    this.body = item.body;
    this.deepLink = item.deepLink;
    this.receivedAt = item.receivedAt.getTime();
    this.readAt = item.readAt?.getTime() ?? null;
  }
}
