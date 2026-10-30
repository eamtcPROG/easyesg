import { Controller, Get, Param, ParseEnumPipe, Query } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { LOCALES, type Locale } from '@easyesg/i18n';
import { LOCALE_ENUM } from '@api/app/constants/locale.constants';
import { ApiListResponse, ApiObjectResponse } from '@api/app/decorators/api-envelope.decorator';
import { Public } from '@api/app/decorators/public.decorator';
import { HelpArticleSummaryResponseDto } from '../dto/help-article-summary.response.dto';
import { HelpArticleResponseDto } from '../dto/help-article.response.dto';
import { HelpTopicResponseDto } from '../dto/help-topic.response.dto';
import { PlanCopyResponseDto } from '../dto/plan-copy.response.dto';
import { ContentService } from '../services/content.service';

const LOCALE_QUERY = {
  name: 'locale',
  enum: LOCALES,
  required: true,
  description:
    'The language to read in. Content is authored in Romanian first; an item with no text in the language asked for ' +
    'is served in Romanian, and says so in its own `locale`.',
} as const;

const NO_LOCALE = { status: 400, description: 'No language, or one the platform does not publish in, was asked for.' };

/**
 * `/api/v1/content` — FR-61's published content, read with no session (task 76; UC-180, UC-181; FR-204;
 * `architecture.md` §12.5.6's task-76 row (1)).
 *
 * **`@Public()`, the decorator's fourth kind**: the help centre is open to everyone — nothing is put behind the account
 * (S-32) — and the home's pricing section reads a plan's copy before anyone has one. Each route serves only what the
 * store holds in force, so a draft has no address.
 *
 * **Limited as generic unauthenticated traffic** at the edge (182/45; §12.5.6's limits table), which task 71.1
 * enforces; nothing here keys a window by address, since until task 71 the address is the proxy's.
 *
 * **No entitlement key**: an entitlement is an organization's (AD-5), and a reader of published content may have none —
 * the help centre is the same for a visitor and for a member on any plan (S-32).
 */
@ApiTags('content')
@Controller('content')
@Public()
export class ContentController {
  constructor(private readonly content: ContentService) {}

  @Get('help/topics')
  @ApiOperation({
    summary: 'The help centre’s topics',
    description: 'UC-180. What a reader may be doing, each a group of articles, in order.',
  })
  @ApiQuery(LOCALE_QUERY)
  @ApiListResponse(HelpTopicResponseDto, { status: 200, description: 'Every topic in force, in order.' })
  @ApiResponse(NO_LOCALE)
  helpTopics(@Query('locale', new ParseEnumPipe(LOCALE_ENUM)) locale: Locale): HelpTopicResponseDto[] {
    return this.content.helpTopics({ locale }).map((topic) => new HelpTopicResponseDto(topic));
  }

  @Get('help/articles')
  @ApiOperation({
    summary: 'The help centre’s library',
    description:
      'UC-180. Every article in force, without its sections, each naming its topic and the module it belongs to, in ' +
      'order. Nothing is gated: a reader with no account reads the whole library.',
  })
  @ApiQuery(LOCALE_QUERY)
  @ApiListResponse(HelpArticleSummaryResponseDto, { status: 200, description: 'Every article in force, in order.' })
  @ApiResponse(NO_LOCALE)
  helpArticles(@Query('locale', new ParseEnumPipe(LOCALE_ENUM)) locale: Locale): HelpArticleSummaryResponseDto[] {
    return this.content.helpArticles({ locale }).map((article) => new HelpArticleSummaryResponseDto(article));
  }

  @Get('help/articles/:key')
  @ApiOperation({
    summary: 'One help article',
    description: 'UC-181. The article whole — its sections in order, and the articles it names to read next.',
  })
  @ApiParam({ name: 'key', description: 'The article’s key, as the library lists it.' })
  @ApiQuery(LOCALE_QUERY)
  @ApiObjectResponse(HelpArticleResponseDto, { status: 200, description: 'The article.' })
  @ApiResponse(NO_LOCALE)
  @ApiResponse({
    status: 404,
    description: 'No article is in force under that key — never published, or not published yet (problem type not-found).',
    content: { 'application/problem+json': {} },
  })
  helpArticle(
    @Param('key') key: string,
    @Query('locale', new ParseEnumPipe(LOCALE_ENUM)) locale: Locale,
  ): HelpArticleResponseDto {
    return new HelpArticleResponseDto(this.content.helpArticle({ key, locale }));
  }

  @Get('plans')
  @ApiOperation({
    summary: 'Each plan’s presentation copy',
    description:
      'FR-204. What the home’s pricing section says of each plan, in order. No price: read prices from the billing ' +
      'catalogue, which versions them.',
  })
  @ApiQuery(LOCALE_QUERY)
  @ApiListResponse(PlanCopyResponseDto, { status: 200, description: 'Every plan’s copy in force, in order.' })
  @ApiResponse(NO_LOCALE)
  planCopy(@Query('locale', new ParseEnumPipe(LOCALE_ENUM)) locale: Locale): PlanCopyResponseDto[] {
    return this.content.planCopy({ locale }).map((copy) => new PlanCopyResponseDto(copy));
  }
}
