import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsObject,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { LOCALES, type Locale } from '@easyesg/i18n';
import type { EpochMillis } from '@api/contracts/types/time';
import { CONTENT_KIND, type ContentKind } from '../constants/content.constants';
import {
  CONTENT_DRAFT_STATE,
  type ContentConsole,
  type ContentDraft,
  type ContentDraftState,
  type ContentFallbackEntry,
  type ContentItem,
  type ContentPublicationPreview,
  type ContentVersionInForce,
} from '../models/content-console.model';

/**
 * A-03's wire (task 67.5; UC-71 … UC-74; §12.5.6's task-67.5 row) — one vocabulary of objects, kept whole. **A payload
 * travels as the store holds it**: the console edits the item the reader reads, and the kind's reader judges it at
 * publication. Instants are epoch milliseconds, converted here and nowhere else.
 */

const PAYLOAD = { type: 'object', additionalProperties: true } as const;

export class ContentVersionInForceResponseDto {
  @ApiProperty() readonly revision: number;
  @ApiProperty({ ...PAYLOAD, description: 'The item as the help centre or the plans read it.' })
  readonly payload: Record<string, unknown>;
  @ApiProperty({ type: Number, description: 'Unix epoch milliseconds when it was put in force.' })
  readonly publishedAt: EpochMillis;
  @ApiProperty({ type: String, nullable: true, format: 'email', description: 'Who published it; null for the seed.' })
  readonly publishedBy: string | null;
  @ApiProperty({ description: 'Whether an earlier version exists to put back in one step.' })
  readonly revertible: boolean;

  constructor(version: ContentVersionInForce) {
    this.revision = version.revision;
    this.payload = version.payload;
    this.publishedAt = version.publishedAt.getTime();
    this.publishedBy = version.publishedBy;
    this.revertible = version.revertible;
  }
}

export class ContentDraftResponseDto {
  @ApiProperty({ format: 'uuid' }) readonly id: string;
  @ApiProperty() readonly revision: number;
  @ApiProperty({ enum: Object.values(CONTENT_DRAFT_STATE), description: 'Being edited, or sent to review.' })
  readonly state: ContentDraftState;
  @ApiProperty({ ...PAYLOAD, description: 'The item as it would be published.' })
  readonly payload: Record<string, unknown>;
  @ApiProperty({ type: Number, description: 'Unix epoch milliseconds when it was last saved.' })
  readonly draftedAt: EpochMillis;
  @ApiProperty({ type: String, nullable: true, format: 'email', description: 'Who last saved it.' })
  readonly draftedBy: string | null;

  constructor(draft: ContentDraft) {
    this.id = draft.id;
    this.revision = draft.revision;
    this.state = draft.state;
    this.payload = draft.payload;
    this.draftedAt = draft.draftedAt.getTime();
    this.draftedBy = draft.draftedBy;
  }
}

export class ContentItemResponseDto {
  @ApiProperty({ enum: Object.values(CONTENT_KIND) }) readonly kind: ContentKind;
  @ApiProperty({ example: 'locking-a-period' }) readonly key: string;
  @ApiProperty({ type: ContentVersionInForceResponseDto, nullable: true, description: 'Null for an item never published.' })
  readonly inForce: ContentVersionInForceResponseDto | null;
  @ApiProperty({ type: ContentDraftResponseDto, nullable: true, description: 'The open draft, if any.' })
  readonly draft: ContentDraftResponseDto | null;

  constructor(item: ContentItem) {
    this.kind = item.kind;
    this.key = item.key;
    this.inForce = item.inForce === null ? null : new ContentVersionInForceResponseDto(item.inForce);
    this.draft = item.draft === null ? null : new ContentDraftResponseDto(item.draft);
  }
}

export class ContentFallbackResponseDto {
  @ApiProperty({ example: 'help_article/locking-a-period', description: 'The item read, as `<kind>/<key>`.' })
  readonly contentKey: string;
  @ApiProperty({ example: 'ru', description: 'The locale it was read in and lacks.' }) readonly locale: string;
  @ApiProperty({ type: Number, description: 'Unix epoch milliseconds when it was first read so.' })
  readonly firstSeenAt: EpochMillis;
  @ApiProperty({ type: Number, description: 'Unix epoch milliseconds when it was last read so.' })
  readonly lastSeenAt: EpochMillis;
  @ApiProperty({ description: 'How many times it was read so — what orders the work.' }) readonly occurrences: number;

  constructor(entry: ContentFallbackEntry) {
    this.contentKey = entry.contentKey;
    this.locale = entry.locale;
    this.firstSeenAt = entry.firstSeenAt.getTime();
    this.lastSeenAt = entry.lastSeenAt.getTime();
    this.occurrences = entry.occurrences;
  }
}

export class LocaleRegistrationResponseDto {
  @ApiProperty({ description: 'The revision in force — sent back with a change, so a colleague’s is not overwritten.' })
  readonly revision!: number;
  @ApiProperty({ type: [String], example: ['ro', 'en', 'ru'], description: 'The locales registered as offered.' })
  readonly codes!: readonly string[];
}

export class ContentConsoleResponseDto {
  @ApiProperty({ type: [ContentItemResponseDto] }) readonly items: readonly ContentItemResponseDto[];
  @ApiProperty({ type: [ContentFallbackResponseDto], description: 'FR-64’s queue, most read first.' })
  readonly fallbacks: readonly ContentFallbackResponseDto[];
  @ApiProperty({ type: LocaleRegistrationResponseDto }) readonly registration: LocaleRegistrationResponseDto;

  constructor(view: ContentConsole) {
    this.items = view.items.map((item) => new ContentItemResponseDto(item));
    this.fallbacks = view.fallbacks.map((entry) => new ContentFallbackResponseDto(entry));
    this.registration = { revision: view.registration.revision, codes: view.registration.codes };
  }
}

export class SaveContentDraftRequestDto {
  @ApiProperty({ ...PAYLOAD, description: 'The whole item, every locale it carries.' })
  @IsObject()
  payload!: Record<string, unknown>;
}

export class ContentItemRefDto {
  @ApiProperty({ enum: Object.values(CONTENT_KIND) })
  @IsIn(Object.values(CONTENT_KIND))
  kind!: ContentKind;

  @ApiProperty({ maxLength: 80, example: 'locking-a-period' })
  @IsString()
  @MaxLength(80)
  key!: string;
}

export class ContentItemsRequestDto {
  @ApiProperty({ type: [ContentItemRefDto], minItems: 1, maxItems: 100, description: 'The items of the set.' })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => ContentItemRefDto)
  items!: ContentItemRefDto[];
}

export class PublishContentRequestDto extends ContentItemsRequestDto {
  @ApiProperty({
    enum: LOCALES,
    isArray: true,
    description: 'The locales the operator signs off — every locale any item of the set carries (NFR-23).',
  })
  @IsArray()
  @IsIn(LOCALES, { each: true })
  signedOff!: Locale[];
}

export class ContentPreviewItemResponseDto {
  @ApiProperty({ enum: Object.values(CONTENT_KIND) }) readonly kind!: ContentKind;
  @ApiProperty() readonly key!: string;
  @ApiProperty({ description: 'Whether a draft in review is there and its reader would read it.' })
  readonly publishable!: boolean;
  @ApiProperty({ enum: LOCALES, isArray: true, description: 'The locales the draft carries.' })
  readonly locales!: readonly Locale[];
  @ApiProperty({ description: 'Whether it replaces a version in force.' }) readonly replaces!: boolean;
}

export class ContentReachResponseDto {
  @ApiProperty({ description: 'Every organization — each one’s members read the help centre and the plans.' })
  readonly organizations!: number;
  @ApiProperty({ description: 'Reports whose content changes — none, for FR-61 content.' }) readonly reports!: number;
}

export class ContentPreviewResponseDto {
  @ApiProperty({ type: [ContentPreviewItemResponseDto] }) readonly items: readonly ContentPreviewItemResponseDto[];
  @ApiProperty({ enum: LOCALES, isArray: true, description: 'The locales the sign-off must name.' })
  readonly locales: readonly Locale[];
  @ApiProperty({ type: ContentReachResponseDto }) readonly reach: ContentReachResponseDto;

  constructor(preview: ContentPublicationPreview) {
    this.items = preview.items;
    this.locales = preview.locales;
    this.reach = preview.reach;
  }
}

export class ContentPublicationResponseDto {
  @ApiProperty({ format: 'uuid', description: 'The publication, which names the set and holds its sign-off.' })
  readonly id: string;

  constructor(publication: { readonly id: string }) {
    this.id = publication.id;
  }
}

export class ContentVersionResponseDto {
  @ApiProperty({ format: 'uuid', description: 'The version put in force.' }) readonly id: string;
  @ApiProperty() readonly revision: number;

  constructor(version: { readonly id: string; readonly revision: number }) {
    this.id = version.id;
    this.revision = version.revision;
  }
}

export class DiscardedDraftResponseDto {
  @ApiProperty({ format: 'uuid', description: 'The draft dropped.' }) readonly id: string;

  constructor(draft: { readonly id: string }) {
    this.id = draft.id;
  }
}

export class LocaleRegistrationRequestDto {
  @ApiProperty({
    enum: LOCALES,
    isArray: true,
    description: 'The built locales to offer. Romanian, the source, is always among them.',
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsIn(LOCALES, { each: true })
  codes!: Locale[];

  @ApiProperty({ minimum: 0, description: 'The revision in force when the operator read it.' })
  @IsInt()
  @Min(0)
  expectedRevision!: number;
}
