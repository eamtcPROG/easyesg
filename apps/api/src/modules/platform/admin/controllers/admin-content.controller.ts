import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiObjectResponse } from '@api/app/decorators/api-envelope.decorator';
import { AUDIT_TARGET, AuditAction } from '@api/app/decorators/audit-action.decorator';
import { AUDIT_ACTION } from '@api/modules/platform/audit/models/audit-action.model';
import { CONTENT_KIND, isContentKind, type ContentKind } from '@api/modules/platform/content/constants/content.constants';
import { ContentKindUnknownError } from '@api/modules/platform/content/errors/content.errors';
import {
  ContentConsoleResponseDto,
  ContentDraftResponseDto,
  ContentItemsRequestDto,
  ContentPreviewResponseDto,
  ContentPublicationResponseDto,
  ContentVersionResponseDto,
  DiscardedDraftResponseDto,
  LocaleRegistrationRequestDto,
  PublishContentRequestDto,
  SaveContentDraftRequestDto,
} from '@api/modules/platform/content/dto/content-console.dto';
import { ContentConsoleService } from '@api/modules/platform/content/services/content-console.service';
import { RequiresAdminPermission } from '../decorators/requires-admin-permission.decorator';
import { RequiresAdminRole } from '../decorators/requires-admin-role.decorator';
import { ADMIN_ROLE } from '../models/admin-session.model';
import { ADMIN_PERMISSION } from '../models/console-role.model';

const PROBLEM = { 'application/problem+json': {} };
const KIND = 'kind';
const KEY = 'key';
const BY_RESULT = { from: AUDIT_TARGET.RESULT } as const;
const KIND_PARAM = { name: KIND, enum: Object.values(CONTENT_KIND), description: 'The kind of item.' } as const;
const KEY_PARAM = { name: KEY, description: 'The item’s key — lower-case words joined by hyphens.' } as const;
/**
 * The item's kind, judged here rather than by `ParseEnumPipe`: beside an `@ApiParam` the pipe reorders the served
 * document's path parameters against the emitted contract, which `docs.e2e-spec.ts` refuses (task 67's close).
 */
const kindOf = (kind: string): ContentKind => {
  if (!isContentKind(kind)) throw new ContentKindUnknownError();
  return kind;
};

const SIGNED_OUT = {
  status: 401,
  description: 'No usable operator session (problem type authentication-required).',
  content: PROBLEM,
} as const;
const NOT_PERMITTED = {
  status: 403,
  description:
    'The operator is not a Platform Administrator, or their roles do not hold the permission (problem type ' +
    'insufficient-role).',
  content: PROBLEM,
} as const;
const NO_DRAFT = {
  status: 409,
  description: 'The item has no draft in the state the step needs (problem type conflict).',
  content: PROBLEM,
} as const;

/**
 * `/api/v1/admin/content` — A-03, the content and translation console (task 67.5; UC-71 … UC-74; FR-61 … FR-64;
 * §12.5.6's task-67.5 row).
 *
 * **The route is the realm's; the behaviour is `platform/content`'s** — A-17's arrangement, for its reason: the realm's
 * guard lives here, and the content module importing `AdminModule` for it would close a cycle. **Editing is
 * `content.edit`**; publishing, reverting and the locale registration are `content.publish` (task 67.13). Every write
 * names its row in A-08's log: a draft's version, a publication, the version put back.
 */
@ApiTags('platform')
@Controller('admin/content')
@RequiresAdminRole(ADMIN_ROLE.PLATFORM_ADMINISTRATOR)
export class AdminContentController {
  constructor(private readonly content: ContentConsoleService) {}

  @Get()
  @RequiresAdminPermission(ADMIN_PERMISSION.CONTENT_EDIT)
  @ApiOperation({
    summary: 'Every help-centre and plan item, FR-64’s queue and the locale registration',
    description: 'Task 67.5. Each item’s version in force and its open draft, the keys read in a locale they lack, and which locales are offered.',
  })
  @ApiObjectResponse(ContentConsoleResponseDto, { status: 200, description: 'A-03’s whole read.' })
  @ApiResponse(SIGNED_OUT)
  @ApiResponse(NOT_PERMITTED)
  async console(): Promise<ContentConsoleResponseDto> {
    return new ContentConsoleResponseDto(await this.content.console());
  }

  @Put(`:${KIND}/:${KEY}/draft`)
  @RequiresAdminPermission(ADMIN_PERMISSION.CONTENT_EDIT)
  @AuditAction({ action: AUDIT_ACTION.ADMIN_CONTENT_DRAFT_SAVED, target: BY_RESULT })
  @ApiOperation({
    summary: 'Save an item’s draft',
    description:
      'Task 67.5 (UC-71). Creates the item’s draft, or edits the one open — which takes it back from review. A draft is ' +
      'live nowhere until a reviewed set is published.',
  })
  @ApiParam(KIND_PARAM)
  @ApiParam(KEY_PARAM)
  @ApiObjectResponse(ContentDraftResponseDto, { status: 200, description: 'The draft as saved.' })
  @ApiResponse({ status: 400, description: 'A key that is not lower-case hyphenated words (problem type validation-failed).', content: PROBLEM })
  @ApiResponse(SIGNED_OUT)
  @ApiResponse(NOT_PERMITTED)
  @ApiResponse({ status: 404, description: 'A kind A-03 does not edit (problem type not-found).', content: PROBLEM })
  async saveDraft(
    @Param(KIND) kindParam: string,
    @Param(KEY) key: string,
    @Body() body: SaveContentDraftRequestDto,
  ): Promise<ContentDraftResponseDto> {
    return new ContentDraftResponseDto(await this.content.saveDraft({ kind: kindOf(kindParam), key, payload: body.payload }));
  }

  @Post(`:${KIND}/:${KEY}/draft/submission`)
  @HttpCode(200)
  @RequiresAdminPermission(ADMIN_PERMISSION.CONTENT_EDIT)
  @AuditAction({ action: AUDIT_ACTION.ADMIN_CONTENT_DRAFT_SUBMITTED, target: BY_RESULT })
  @ApiOperation({ summary: 'Send an item’s draft to review', description: 'Task 67.5 (UC-72).' })
  @ApiParam(KIND_PARAM)
  @ApiParam(KEY_PARAM)
  @ApiObjectResponse(ContentDraftResponseDto, { status: 200, description: 'The draft, in review.' })
  @ApiResponse(SIGNED_OUT)
  @ApiResponse(NOT_PERMITTED)
  @ApiResponse(NO_DRAFT)
  async submitDraft(
    @Param(KIND) kindParam: string,
    @Param(KEY) key: string,
  ): Promise<ContentDraftResponseDto> {
    return new ContentDraftResponseDto(await this.content.submitDraft({ kind: kindOf(kindParam), key }));
  }

  @Delete(`:${KIND}/:${KEY}/draft`)
  @RequiresAdminPermission(ADMIN_PERMISSION.CONTENT_EDIT)
  @AuditAction({ action: AUDIT_ACTION.ADMIN_CONTENT_DRAFT_DISCARDED, target: BY_RESULT })
  @ApiOperation({ summary: 'Drop an item’s draft', description: 'Task 67.5. What is in force is untouched.' })
  @ApiParam(KIND_PARAM)
  @ApiParam(KEY_PARAM)
  @ApiObjectResponse(DiscardedDraftResponseDto, { status: 200, description: 'The draft dropped.' })
  @ApiResponse(SIGNED_OUT)
  @ApiResponse(NOT_PERMITTED)
  @ApiResponse(NO_DRAFT)
  async discardDraft(
    @Param(KIND) kindParam: string,
    @Param(KEY) key: string,
  ): Promise<DiscardedDraftResponseDto> {
    return new DiscardedDraftResponseDto(await this.content.discardDraft({ kind: kindOf(kindParam), key }));
  }

  @Post('publication/preview')
  @HttpCode(200)
  @RequiresAdminPermission(ADMIN_PERMISSION.CONTENT_PUBLISH)
  @ApiOperation({
    summary: 'Preview a set’s publication',
    description:
      'Task 67.5 (UX-123). For each item, whether it can be published and the locales it carries; the locales the ' +
      'sign-off must name; and who it reaches. Writes nothing.',
  })
  @ApiObjectResponse(ContentPreviewResponseDto, { status: 200, description: 'What publishing the set would do.' })
  @ApiResponse(SIGNED_OUT)
  @ApiResponse(NOT_PERMITTED)
  async preview(@Body() body: ContentItemsRequestDto): Promise<ContentPreviewResponseDto> {
    return new ContentPreviewResponseDto(await this.content.preview({ items: body.items }));
  }

  @Post('publication')
  @RequiresAdminPermission(ADMIN_PERMISSION.CONTENT_PUBLISH)
  @AuditAction({ action: AUDIT_ACTION.ADMIN_CONTENT_PUBLISHED, target: BY_RESULT })
  @ApiOperation({
    summary: 'Publish a reviewed set',
    description:
      'Task 67.5 (UC-72; FR-62). Every item’s draft in review, in one transaction, the sign-off of each locale ' +
      'recorded on the publication. In force for every tenant at once, or not at all.',
  })
  @ApiObjectResponse(ContentPublicationResponseDto, { status: 201, description: 'The set is in force.' })
  @ApiResponse({
    status: 400,
    description:
      'A locale an item carries is not signed off, or an item would not be read whole (problem type validation-failed).',
    content: PROBLEM,
  })
  @ApiResponse(SIGNED_OUT)
  @ApiResponse(NOT_PERMITTED)
  @ApiResponse(NO_DRAFT)
  async publish(@Body() body: PublishContentRequestDto): Promise<ContentPublicationResponseDto> {
    return new ContentPublicationResponseDto(
      await this.content.publish({ items: body.items, signedOff: body.signedOff }),
    );
  }

  @Post(`:${KIND}/:${KEY}/reversion`)
  @HttpCode(200)
  @RequiresAdminPermission(ADMIN_PERMISSION.CONTENT_PUBLISH)
  @AuditAction({ action: AUDIT_ACTION.ADMIN_CONTENT_REVERTED, target: BY_RESULT })
  @ApiOperation({
    summary: 'Put an item’s previous version back',
    description: 'Task 67.5 (NFR-85). One item; the rest of its set stays in force.',
  })
  @ApiParam(KIND_PARAM)
  @ApiParam(KEY_PARAM)
  @ApiObjectResponse(ContentVersionResponseDto, { status: 200, description: 'The version put back.' })
  @ApiResponse(SIGNED_OUT)
  @ApiResponse(NOT_PERMITTED)
  @ApiResponse({ status: 404, description: 'A kind A-03 does not edit (problem type not-found).', content: PROBLEM })
  @ApiResponse({ status: 409, description: 'There is no earlier version (problem type conflict).', content: PROBLEM })
  async revert(@Param(KIND) kindParam: string, @Param(KEY) key: string): Promise<ContentVersionResponseDto> {
    return new ContentVersionResponseDto(await this.content.revert({ kind: kindOf(kindParam), key }));
  }

  @Put('locale-registration')
  @RequiresAdminPermission(ADMIN_PERMISSION.CONTENT_PUBLISH)
  @AuditAction({ action: AUDIT_ACTION.ADMIN_LOCALE_REGISTRATION_PUBLISHED, target: BY_RESULT })
  @ApiOperation({
    summary: 'Change which built locales are offered',
    description: 'Task 67.5 (UC-73; FR-63). Romanian, the source, is always offered.',
  })
  @ApiObjectResponse(ContentVersionResponseDto, { status: 200, description: 'The registration put in force.' })
  @ApiResponse({
    status: 400,
    description: 'No Romanian, or a locale the build has no catalogue for (problem type validation-failed).',
    content: PROBLEM,
  })
  @ApiResponse(SIGNED_OUT)
  @ApiResponse(NOT_PERMITTED)
  @ApiResponse({
    status: 409,
    description: 'A colleague changed the registration since it was read (problem type conflict).',
    content: PROBLEM,
  })
  async publishRegistration(@Body() body: LocaleRegistrationRequestDto): Promise<ContentVersionResponseDto> {
    return new ContentVersionResponseDto(
      await this.content.publishRegistration({ codes: body.codes, expectedRevision: body.expectedRevision }),
    );
  }
}
