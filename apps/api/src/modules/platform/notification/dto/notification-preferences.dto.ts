import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsIn, ValidateNested } from 'class-validator';
import { NOTIFICATION_CATEGORY, type NotificationCategoryKey } from '@api/contracts/notification.port';
import { NOTIFICATION_CHANNEL, type NotificationChannel } from '../models/notification-category.model';
import type {
  CategoryPreferencesItem,
  ChannelPreference,
  NotificationPreferencePair,
} from '../models/notification-preference.model';

/**
 * S-27's notification preferences on the wire (task 52.1; UC-168, FR-9, FR-163; §12.5.6's task-52.1 row) — one
 * vocabulary: the pair a person switches, and the read that offers them. Keys, never text to show; the one text is
 * each category's name, resolved in the negotiated language.
 */

const CATEGORY_KEYS = Object.values(NOTIFICATION_CATEGORY);
const CHANNELS = Object.values(NOTIFICATION_CHANNEL);

/**
 * Bounds the write, never the choice: no more pairs than every category on every channel, so a body that names more
 * repeats itself and is refused before anything is read.
 */
const MOST_PAIRS = CATEGORY_KEYS.length * CHANNELS.length;

/** One channel of one category — what a person switches off. */
export class NotificationPreferencePairDto implements NotificationPreferencePair {
  @ApiProperty({ enum: CATEGORY_KEYS, description: 'The category — a key for the client to act on, never text to show.' })
  @IsIn(CATEGORY_KEYS)
  categoryKey!: NotificationCategoryKey;

  @ApiProperty({ enum: CHANNELS, description: 'The channel it is switched off on.' })
  @IsIn(CHANNELS)
  channel!: NotificationChannel;
}

export class SetNotificationPreferencesRequestDto {
  @ApiProperty({
    type: [NotificationPreferencePairDto],
    maxItems: MOST_PAIRS,
    description:
      'Every pair the person has switched off, among those the read offers; every offered pair not named is switched ' +
      'on. A pair the read does not offer — a mandatory category, or a channel the category does not travel on — ' +
      'refuses the whole write. Empty switches everything on.',
  })
  @IsArray()
  @ArrayMaxSize(MOST_PAIRS)
  @ValidateNested({ each: true })
  @Type(() => NotificationPreferencePairDto)
  switchedOff!: NotificationPreferencePairDto[];
}

export class ChannelPreferenceResponseDto {
  @ApiProperty({ enum: CHANNELS })
  channel: NotificationChannel;

  @ApiProperty({ description: 'Whether the category reaches the person on this channel. Always true on a mandatory category.' })
  enabled: boolean;

  constructor(preference: ChannelPreference) {
    this.channel = preference.channel;
    this.enabled = preference.enabled;
  }
}

export class CategoryPreferencesResponseDto {
  @ApiProperty({ enum: CATEGORY_KEYS, description: 'The category — a key for the client to act on, never text to show.' })
  categoryKey: NotificationCategoryKey;

  @ApiProperty({
    required: false,
    description: 'The category’s name in the negotiated language. Absent when none is written.',
  })
  categoryName?: string;

  @ApiProperty({
    description:
      'Whether the category may not be switched off — security, account, invoice delivery, payment failure and ' +
      'service restriction notices. A mandatory category is listed on every channel it travels on, switched on.',
  })
  mandatory: boolean;

  @ApiProperty({
    type: [ChannelPreferenceResponseDto],
    description: 'The channels the category reaches the person on, in-app and email, never empty.',
  })
  channels: ChannelPreferenceResponseDto[];

  constructor(category: CategoryPreferencesItem) {
    this.categoryKey = category.categoryKey;
    if (category.categoryName !== undefined) this.categoryName = category.categoryName;
    this.mandatory = category.mandatory;
    this.channels = category.channels.map((channel) => new ChannelPreferenceResponseDto(channel));
  }
}

export class NotificationPreferencesResponseDto {
  @ApiProperty({
    type: [CategoryPreferencesResponseDto],
    description:
      'Every category the account can receive, in a fixed order, the same in every organization it belongs to.',
  })
  categories: CategoryPreferencesResponseDto[];

  constructor(categories: readonly CategoryPreferencesItem[]) {
    this.categories = categories.map((category) => new CategoryPreferencesResponseDto(category));
  }
}
