import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayMinSize, ArrayUnique, IsIn, IsInt, Min } from 'class-validator';
import { LOCALES, type Locale } from '@easyesg/i18n';
import { NOTIFICATION_CATEGORY, type NotificationCategoryKey } from '@api/contracts/notification.port';
import type { EpochMillis } from '@api/contracts/types/time';
import type { RenderedCategoryWording } from '../interfaces/category-wording.interface';
import {
  PUBLICATION_CONSEQUENCE,
  type ConsoleCategory,
  type PublicationConsequence,
  type PublicationConsequenceKind,
} from '../models/category-console.model';
import {
  NOTIFICATION_CHANNEL,
  NOTIFICATION_CLASSIFICATION,
  type NotificationCategoryBehaviour,
  type NotificationChannel,
  type NotificationClassification,
} from '../models/notification-category.model';

/**
 * A-17 on the wire (task 67.10; UC-176, FR-173; §12.5.6's task-67.10 row) — one vocabulary: the catalogue read, the
 * behaviour a preview and a publication propose, the revision a write is made against, and what it discloses.
 */

const CATEGORY_KEYS = Object.values(NOTIFICATION_CATEGORY);
const CHANNELS = Object.values(NOTIFICATION_CHANNEL);
const CLASSIFICATIONS = Object.values(NOTIFICATION_CLASSIFICATION);

export class CategoryBehaviourRequestDto {
  @ApiProperty({ enum: CHANNELS, isArray: true, minItems: 1, maxItems: CHANNELS.length, description: 'Where it travels.' })
  @ArrayMinSize(1)
  @ArrayMaxSize(CHANNELS.length)
  @ArrayUnique()
  @IsIn(CHANNELS, { each: true })
  channels!: NotificationChannel[];

  @ApiProperty({ enum: CLASSIFICATIONS, description: 'Whether a recipient may switch it off (FR-163).' })
  @IsIn(CLASSIFICATIONS)
  classification!: NotificationClassification;
}

export class CategoryPublicationRequestDto extends CategoryBehaviourRequestDto {
  @ApiProperty({
    type: 'integer',
    minimum: 0,
    description: 'The revision in force when the change was made — 0 where none is. Any other refuses the write.',
  })
  @IsInt()
  @Min(0)
  expectedRevision!: number;
}

export class CategoryReversionRequestDto {
  @ApiProperty({ type: 'integer', minimum: 1, description: 'The revision in force when the revert was asked for.' })
  @IsInt()
  @Min(1)
  expectedRevision!: number;
}

export class CategoryPublicationResponseDto {
  @ApiProperty({ format: 'uuid', description: 'The configuration version now in force.' })
  id: string;

  @ApiProperty({ type: 'integer' })
  revision: number;

  constructor(version: { readonly id: string; readonly revision: number }) {
    this.id = version.id;
    this.revision = version.revision;
  }
}

export class CategoryConsequenceResponseDto {
  @ApiProperty({ enum: Object.values(PUBLICATION_CONSEQUENCE) })
  kind: PublicationConsequenceKind;

  @ApiProperty({ type: 'integer', required: false, description: 'People whose switch-offs stop counting.' })
  people?: number;

  @ApiProperty({ enum: CHANNELS, required: false })
  channel?: NotificationChannel;

  @ApiProperty({
    type: 'integer',
    required: false,
    description: 'People who switched it off on the channel added before, whose choice holds again.',
  })
  stayingOff?: number;

  constructor(consequence: PublicationConsequence) {
    this.kind = consequence.kind;
    if ('people' in consequence) this.people = consequence.people;
    if ('channel' in consequence) this.channel = consequence.channel;
    if ('stayingOff' in consequence) this.stayingOff = consequence.stayingOff;
  }
}

export class CategoryPreviewResponseDto {
  @ApiProperty({
    type: [CategoryConsequenceResponseDto],
    description: 'What the change would do for recipients; empty where it changes nothing for anyone.',
  })
  consequences: CategoryConsequenceResponseDto[];

  constructor(consequences: readonly PublicationConsequence[]) {
    this.consequences = consequences.map((each) => new CategoryConsequenceResponseDto(each));
  }
}

class CategoryEmailWordingDto {
  @ApiProperty()
  subject!: string;

  @ApiProperty()
  body!: string;
}

class CategoryInAppWordingDto {
  @ApiProperty()
  title!: string;

  @ApiProperty()
  body!: string;

  @ApiProperty({ required: false })
  action?: string;
}

export class CategoryWordingResponseDto {
  @ApiProperty({ enum: [...LOCALES] })
  locale: Locale;

  @ApiProperty({ required: false, description: 'The category’s name in this locale; absent where none is written.' })
  name?: string;

  @ApiProperty({ type: CategoryEmailWordingDto, required: false, description: 'Absent where no email wording is written.' })
  email?: CategoryEmailWordingDto;

  @ApiProperty({ type: CategoryInAppWordingDto, required: false, description: 'Absent where no in-app wording is written.' })
  inApp?: CategoryInAppWordingDto;

  constructor(wording: RenderedCategoryWording) {
    this.locale = wording.locale;
    if (wording.name !== undefined) this.name = wording.name;
    if (wording.email !== undefined) this.email = { ...wording.email };
    if (wording.inApp !== undefined) this.inApp = { ...wording.inApp };
  }
}

/** A behaviour as the console reads it — the revert's preview input (task 67.10). */
class CategoryBehaviourDto {
  @ApiProperty({ enum: CHANNELS, isArray: true })
  channels: NotificationChannel[];

  @ApiProperty({ enum: CLASSIFICATIONS })
  classification: NotificationClassification;

  constructor(behaviour: NotificationCategoryBehaviour) {
    this.channels = [...behaviour.channels];
    this.classification = behaviour.classification;
  }
}

class CategoryInForceDto {
  @ApiProperty({ enum: CHANNELS, isArray: true, nullable: true, description: 'Null where the artefact cannot be read.' })
  channels: NotificationChannel[] | null;

  @ApiProperty({ enum: CLASSIFICATIONS, nullable: true, description: 'Null where the artefact cannot be read.' })
  classification: NotificationClassification | null;

  @ApiProperty({ type: 'integer' })
  revision: number;

  @ApiProperty({ type: 'integer', nullable: true, description: 'Unix epoch milliseconds, UTC.' })
  publishedAt: EpochMillis | null;

  @ApiProperty({ type: String, nullable: true, description: 'The publishing operator; null for a seeded revision.' })
  publishedBy: string | null;

  @ApiProperty({ type: 'integer', nullable: true, description: 'What a one-step revert would restore; null where none.' })
  previousRevision: number | null;

  @ApiProperty({
    type: CategoryBehaviourDto,
    nullable: true,
    description:
      'What a one-step revert would put in force — previewed as a publication is. Null where there is no previous ' +
      'revision, or it cannot be read.',
  })
  previous: CategoryBehaviourDto | null;

  constructor(inForce: NonNullable<ConsoleCategory['inForce']>) {
    this.channels = inForce.behaviour === null ? null : [...inForce.behaviour.channels];
    this.classification = inForce.behaviour?.classification ?? null;
    this.revision = inForce.revision;
    this.publishedAt = inForce.publishedAt === null ? null : inForce.publishedAt.getTime();
    this.publishedBy = inForce.publishedBy;
    this.previousRevision = inForce.previousRevision;
    this.previous = inForce.previousBehaviour === null ? null : new CategoryBehaviourDto(inForce.previousBehaviour);
  }
}

class CategorySwitchOffsDto {
  @ApiProperty({ type: 'integer' })
  inApp!: number;

  @ApiProperty({ type: 'integer' })
  email!: number;

  @ApiProperty({ type: 'integer', description: 'Distinct people with a switch-off on any channel.' })
  people!: number;
}

export class ConsoleCategoryResponseDto {
  @ApiProperty({ enum: CATEGORY_KEYS, description: 'A key for the console to act on, never text to show.' })
  categoryKey: NotificationCategoryKey;

  @ApiProperty({ description: 'Code declares it mandatory: its classification is fixed and it travels by email.' })
  mandatory: boolean;

  @ApiProperty({ description: 'A notice sent to an address with a token in its link: it never travels in-app.' })
  addressNotice: boolean;

  @ApiProperty({ type: CategoryInForceDto, nullable: true, description: 'Null where nothing is in force.' })
  inForce: CategoryInForceDto | null;

  @ApiProperty({ type: CategorySwitchOffsDto })
  switchOffs: CategorySwitchOffsDto;

  @ApiProperty({
    type: [CategoryWordingResponseDto],
    description: 'Its words in every locale, rendered with its example values; read-only — wording ships with a release.',
  })
  wording: CategoryWordingResponseDto[];

  constructor(category: ConsoleCategory, wording: readonly RenderedCategoryWording[]) {
    this.categoryKey = category.categoryKey;
    this.mandatory = category.mandatory;
    this.addressNotice = category.addressNotice;
    this.inForce = category.inForce === null ? null : new CategoryInForceDto(category.inForce);
    this.switchOffs = {
      inApp: category.switchOffs.byChannel.in_app,
      email: category.switchOffs.byChannel.email,
      people: category.switchOffs.people,
    };
    this.wording = wording.map((each) => new CategoryWordingResponseDto(each));
  }
}
