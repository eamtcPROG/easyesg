import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { NOTIFICATION_CATEGORY, type NotificationCategoryKey } from '@api/contracts/notification.port';
import { UNSUBSCRIBE_STANDING, type UnsubscribeStanding } from '../models/unsubscribe.model';

/**
 * FR-169's one-click unsubscribe on the wire (task 52.2.2; §12.5.6's task-52.2 row) — one vocabulary: the token both
 * calls take, and the standing both answer.
 */

export class UnsubscribeTokenRequestDto {
  @ApiProperty({
    description:
      'The signed token from the unsubscribe link. In the body, as the invitation’s is, so the api’s own logs never ' +
      'carry it; the link that holds it is a page on the tenant application.',
    minLength: 1,
    maxLength: 512,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(512)
  token!: string;
}

export class UnsubscribeResponseDto {
  @ApiProperty({
    enum: Object.values(UNSUBSCRIBE_STANDING),
    description:
      'What the link can do: `available` — the category still reaches the person by email and the link can switch it ' +
      'off; `switched_off` — it no longer does; `unusable` — the link can switch nothing off.',
  })
  standing: UnsubscribeStanding;

  @ApiProperty({
    enum: Object.values(NOTIFICATION_CATEGORY),
    required: false,
    description: 'The category the link is about — a key to act on, never text to show. Absent when unusable.',
  })
  categoryKey?: NotificationCategoryKey;

  @ApiProperty({
    required: false,
    description: 'The category’s name in the negotiated language. Absent when unusable, or when none is written.',
  })
  categoryName?: string;

  constructor(answer: {
    readonly standing: UnsubscribeStanding;
    readonly categoryKey?: NotificationCategoryKey;
    readonly categoryName?: string;
  }) {
    this.standing = answer.standing;
    if (answer.categoryKey !== undefined) this.categoryKey = answer.categoryKey;
    if (answer.categoryName !== undefined) this.categoryName = answer.categoryName;
  }
}
