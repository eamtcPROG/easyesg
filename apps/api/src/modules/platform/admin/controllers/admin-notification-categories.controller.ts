import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiListResponse, ApiObjectResponse } from '@api/app/decorators/api-envelope.decorator';
import { AUDIT_TARGET, AuditAction } from '@api/app/decorators/audit-action.decorator';
import { NOTIFICATION_CATEGORY } from '@api/contracts/notification.port';
import { AUDIT_ACTION } from '@api/modules/platform/audit/models/audit-action.model';
import {
  CategoryBehaviourRequestDto,
  CategoryPreviewResponseDto,
  CategoryPublicationRequestDto,
  CategoryPublicationResponseDto,
  CategoryReversionRequestDto,
  ConsoleCategoryResponseDto,
} from '@api/modules/platform/notification/dto/category-console.dto';
import { CategoryConsoleService } from '@api/modules/platform/notification/services/category-console.service';
import { RequiresAdminRole } from '../decorators/requires-admin-role.decorator';
import { ADMIN_ROLE } from '../models/admin-session.model';

const PROBLEM = { 'application/problem+json': {} };
const CATEGORY = 'category';
const PUT_IN_FORCE = { from: AUDIT_TARGET.RESULT } as const;
const CATEGORY_PARAM = { name: CATEGORY, enum: Object.values(NOTIFICATION_CATEGORY), description: 'The category.' } as const;

const SIGNED_OUT = {
  status: 401,
  description: 'No usable operator session (problem type authentication-required).',
  content: PROBLEM,
} as const;
const NOT_PLATFORM_ADMINISTRATOR = {
  status: 403,
  description: 'The operator’s role is not platform_administrator (problem type insufficient-role).',
  content: PROBLEM,
} as const;
const NO_SUCH_CATEGORY = {
  status: 404,
  description: 'The path names no category this release raises (problem type not-found).',
  content: PROBLEM,
} as const;
const REFUSED = {
  status: 400,
  description:
    'A rule the platform declares forbids the behaviour — a mandatory category must be transactional and travel by ' +
    'email, a notice sent to an address never travels in-app, and a channel needs its wording in every language ' +
    '(problem type validation-failed). Nothing was published.',
  content: PROBLEM,
} as const;
const CHANGED = {
  status: 409,
  description:
    'A newer revision is in force (problem type notification-category-changed), or the change is what is already in ' +
    'force, or there is nothing to revert to (problem type conflict).',
  content: PROBLEM,
} as const;

/**
 * `/api/v1/admin/notification-categories` — A-17 (task 67.10; UC-176, FR-173, NFR-85; §12.5.6's task-67.10 row).
 *
 * **The route is the realm's; the behaviour is `platform/notification`'s** — A-18's arrangement (the task-67.11 row):
 * `platform/notification` owns FR-173, the category catalogue, its rules and the use cases, and exports the one service
 * this controller calls; `platform/admin` owns the realm, its guard and this surface. **Here rather than in the
 * notification module because `AdminModule` already imports that one** — for the invitation email on the worker — so
 * a notification module importing the realm back is a module cycle, which `no-circular` refused and which failed the
 * worker's boot before it (§12.5.6's task-67.10 row). **For a Platform Administrator.** Each write names, in A-08's
 * log, the configuration version it put in force — a category has no id of its own.
 *
 * **Every write carries the revision it was made against**, so two operators editing one category never overwrite each
 * other; **a revert is a republication of the revision before the one in force** (UX-123's one step). No
 * `@RequiresEntitlement`: the console is the platform's, and no plan is asked.
 */
@ApiTags('platform')
@Controller('admin/notification-categories')
@RequiresAdminRole(ADMIN_ROLE.PLATFORM_ADMINISTRATOR)
export class AdminNotificationCategoriesController {
  constructor(private readonly categories: CategoryConsoleService) {}

  @Get()
  @ApiOperation({
    summary: 'List the notification categories and the behaviour of each',
    description:
      'UC-176. Every category this release raises: whether the platform declares it mandatory or a notice sent to an ' +
      'address, the behaviour in force and who published it, how many people switched it off, and its wording in ' +
      'every language rendered with example values — read-only, since wording ships with a release.',
  })
  @ApiListResponse(ConsoleCategoryResponseDto, { status: 200, description: 'Every category, in a fixed order.' })
  @ApiResponse(SIGNED_OUT)
  @ApiResponse(NOT_PLATFORM_ADMINISTRATOR)
  async list(): Promise<ConsoleCategoryResponseDto[]> {
    return (await this.categories.list()).map(({ category, wording }) => new ConsoleCategoryResponseDto(category, wording));
  }

  @Post(`:${CATEGORY}/preview`)
  @HttpCode(200)
  @ApiOperation({
    summary: 'Say what publishing a behaviour would change for recipients, without publishing it',
    description: 'UX-123’s scope disclosure: the people whose choices stop counting, and the channels gained or lost.',
  })
  @ApiParam(CATEGORY_PARAM)
  @ApiObjectResponse(CategoryPreviewResponseDto, { status: 200, description: 'What would change.' })
  @ApiResponse(REFUSED)
  @ApiResponse(SIGNED_OUT)
  @ApiResponse(NOT_PLATFORM_ADMINISTRATOR)
  @ApiResponse(NO_SUCH_CATEGORY)
  async preview(
    @Param(CATEGORY) category: string,
    @Body() body: CategoryBehaviourRequestDto,
  ): Promise<CategoryPreviewResponseDto> {
    return new CategoryPreviewResponseDto(
      await this.categories.preview({ category, behaviour: { channels: body.channels, classification: body.classification } }),
    );
  }

  @Post(`:${CATEGORY}/publication`)
  @HttpCode(201)
  @AuditAction({ action: AUDIT_ACTION.ADMIN_NOTIFICATION_CATEGORY_PUBLISHED, target: PUT_IN_FORCE })
  @ApiOperation({
    summary: 'Publish a category’s channels and classification',
    description:
      'UC-176. In force within seconds with no redeploy. Recorded in the system audit log. The wording does not ' +
      'change here — it ships with a release.',
  })
  @ApiParam(CATEGORY_PARAM)
  @ApiObjectResponse(CategoryPublicationResponseDto, { status: 201, description: 'The revision now in force.' })
  @ApiResponse(REFUSED)
  @ApiResponse(SIGNED_OUT)
  @ApiResponse(NOT_PLATFORM_ADMINISTRATOR)
  @ApiResponse(NO_SUCH_CATEGORY)
  @ApiResponse(CHANGED)
  async publish(
    @Param(CATEGORY) category: string,
    @Body() body: CategoryPublicationRequestDto,
  ): Promise<CategoryPublicationResponseDto> {
    return new CategoryPublicationResponseDto(
      await this.categories.publish({
        category,
        behaviour: { channels: body.channels, classification: body.classification },
        expectedRevision: body.expectedRevision,
      }),
    );
  }

  @Post(`:${CATEGORY}/reversion`)
  @HttpCode(201)
  @AuditAction({ action: AUDIT_ACTION.ADMIN_NOTIFICATION_CATEGORY_REVERTED, target: PUT_IN_FORCE })
  @ApiOperation({
    summary: 'Put back the behaviour before the one in force',
    description:
      'UX-123’s one-step revert: the previous revision’s behaviour, published again, so a second revert undoes the ' +
      'first. Recorded in the system audit log.',
  })
  @ApiParam(CATEGORY_PARAM)
  @ApiObjectResponse(CategoryPublicationResponseDto, { status: 201, description: 'The revision now in force.' })
  @ApiResponse(REFUSED)
  @ApiResponse(SIGNED_OUT)
  @ApiResponse(NOT_PLATFORM_ADMINISTRATOR)
  @ApiResponse(NO_SUCH_CATEGORY)
  @ApiResponse(CHANGED)
  async revert(
    @Param(CATEGORY) category: string,
    @Body() body: CategoryReversionRequestDto,
  ): Promise<CategoryPublicationResponseDto> {
    return new CategoryPublicationResponseDto(
      await this.categories.revert({ category, expectedRevision: body.expectedRevision }),
    );
  }
}
