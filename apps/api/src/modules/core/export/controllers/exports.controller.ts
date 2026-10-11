import { Body, Controller, Get, Header, HttpCode, Param, ParseUUIDPipe, Post, Req, StreamableFile, UseInterceptors } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiProduces, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { DEFAULT_ON_PAGE } from '@api/app/constants/pagination.constants';
import { ApiListResponse, ApiObjectResponse } from '@api/app/decorators/api-envelope.decorator';
import { RequestListDto } from '@api/app/dto/request-list.dto';
import { ResultListDto } from '@api/app/dto/result-list.dto';
import { ListQueryInterceptor } from '@api/app/interceptors/list-query.interceptor';
import { LOCALES } from '@easyesg/i18n';
import { SORT_DIRECTION } from '@api/contracts/types/list-query';
import { NO_SUCH_REPORT } from '@api/modules/core/disclosure/errors/report.errors';
import { RequiresRole } from '@api/modules/identity/membership/decorators/requires-role.decorator';
import { MEMBERSHIP_ROLE } from '@api/modules/identity/membership/models/membership.model';
import { EXPORT_FORMAT, EXPORT_MEDIA_TYPE, EXPORT_STATUS } from '../constants/export.constants';
import { attachmentDisposition } from '../domain/export-file-name';
import { ExportResponseDto } from '../dto/export.dto';
import { ExportLanguagesResponseDto } from '../dto/export-languages.dto';
import { RequestExportRequestDto } from '../dto/export-request.dto';
import { NO_SUCH_EXPORT } from '../errors/export.errors';
import { EXPORT_HISTORY_FILTER, EXPORT_HISTORY_SORT } from '../models/export-history-query.model';
import { ExportService } from '../services/export.service';

const PROBLEM = { 'application/problem+json': {} };

/**
 * S-11's api (tasks 47.1, 47.4; FR-44, FR-49 … FR-53; §12.5.6's task-47 row (a)): **ask for an export, read a report's
 * history of them, watch one, and download its file** — and, for the dialogue, the languages a file may be written in
 * with whose words each one's labels are (row (k)). Every route admits an editor or the Organization Administrator
 * and refuses a view-only member (182/22).
 *
 * **Nothing renders here** (AD-10): a request writes the export's record and its job and answers 202 with the record,
 * whose id is the job's; the worker produces the file. **The file leaves as itself**, a `StreamableFile` past the
 * envelope (FR-53 behaviour 4), and is never gated by an entitlement (FR-104). **Recorded deferral: no entitlement gate
 * on the request until task 54** (row (e)).
 */
@ApiTags('export')
@Controller()
@RequiresRole(MEMBERSHIP_ROLE.EDITOR, MEMBERSHIP_ROLE.ORGANIZATION_ADMINISTRATOR)
export class ExportsController {
  constructor(private readonly exports: ExportService) {}

  @Post('reports/:id/exports')
  @HttpCode(202)
  @ApiOperation({
    summary: 'Ask for an export of the report (UC-42, UC-43)',
    description:
      'Runs validation, keeping the run as the report’s, then queues the file in the language asked for, at the ' +
      'report’s own pinned versions (FR-51). A report holding unresolved findings is refused with them listed unless ' +
      'the request acknowledges them (FR-44). The report’s status is not changed (FR-41).',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiObjectResponse(ExportResponseDto, { status: 202, description: 'The export, requested; its id is its job’s.' })
  @ApiResponse({ status: 404, description: NO_SUCH_REPORT, content: PROBLEM })
  @ApiResponse({
    status: 409,
    description:
      'The report holds unresolved findings and the request did not acknowledge them (problem type ' +
      'export-findings-unacknowledged); `findings` lists them as this request evaluated them, each as the report’s ' +
      'validation read names it.',
    content: PROBLEM,
  })
  @ApiResponse({ status: 503, description: 'No validation rule set can be read, so the request cannot be judged.', content: PROBLEM })
  async request(@Param('id', ParseUUIDPipe) id: string, @Body() body: RequestExportRequestDto): Promise<ExportResponseDto> {
    return new ExportResponseDto(
      await this.exports.request({
        reportId: id,
        format: body.format,
        locale: body.locale,
        acknowledgeUnresolvedFindings: body.acknowledgeUnresolvedFindings === true,
      }),
    );
  }

  @Get('reports/:id/exports')
  // An instance, not the class: see `AccessController` for what the class does to the application's boot.
  @UseInterceptors(new ListQueryInterceptor())
  @ApiOperation({
    summary: 'The report’s export history (UC-44)',
    description:
      'Every export of the report — requested, completed or failed — with its format, language, pinned versions, ' +
      'when and by whom it was asked for (UX-49).',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiQuery({
    name: 'filters',
    required: false,
    description:
      `Compact facets, pipe-separated: \`${EXPORT_HISTORY_FILTER.FORMAT},<${Object.values(EXPORT_FORMAT).join('|')}>\`, ` +
      `\`${EXPORT_HISTORY_FILTER.LANGUAGE},<${LOCALES.join('|')}>\`, \`${EXPORT_HISTORY_FILTER.TAXONOMY_VERSION},<version>\` and ` +
      `\`${EXPORT_HISTORY_FILTER.STATUS},<${Object.values(EXPORT_STATUS).join('|')}>\`, ` +
      'each taking several values. A value no export can hold is ignored rather than refused.',
  })
  @ApiQuery({
    name: 'order',
    required: false,
    description:
      `One ordering, \`${EXPORT_HISTORY_SORT.REQUESTED},<${Object.values(SORT_DIRECTION).join('|')}>\`. Defaults to ` +
      `\`${EXPORT_HISTORY_SORT.REQUESTED},${SORT_DIRECTION.DESC}\` — newest first.`,
  })
  @ApiQuery({ name: 'page', required: false, type: Number, description: '1-based.' })
  @ApiQuery({
    name: 'onpage',
    required: false,
    type: Number,
    description: `Exports per page, ${DEFAULT_ON_PAGE} unless given. \`-1\` (all rows) is refused on this route.`,
  })
  @ApiListResponse(ExportResponseDto, {
    status: 200,
    description:
      'One page of the history. `total` counts the exports the facets admit; `unfiltered` counts the report’s exports ' +
      'before them, which tells an empty page whether nothing has been exported yet or the facets matched nothing.',
  })
  @ApiResponse({ status: 404, description: NO_SUCH_REPORT, content: PROBLEM })
  async list(@Param('id', ParseUUIDPipe) id: string, @Req() request: Request): Promise<ResultListDto<ExportResponseDto>> {
    const page = await this.exports.list({ reportId: id, list: request.requestList ?? new RequestListDto() });
    return new ResultListDto({
      objects: page.records.map((record) => new ExportResponseDto(record)),
      total: page.matched,
      totalpages: Math.max(1, Math.ceil(page.matched / page.take)),
      unfiltered: page.total,
    });
  }

  @Get('reports/:id/exports/languages')
  @ApiOperation({
    summary: 'The languages an export of the report may be written in (FR-52, UX-47)',
    description:
      'Every language a file may be written in, each with whether its labels are EFRAG’s own or platform-authored at ' +
      'the report’s pinned taxonomy version — what the export dialogue says beside a language that carries no EFRAG ' +
      'standing.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiObjectResponse(ExportLanguagesResponseDto, { status: 200, description: 'The languages, in the platform’s order.' })
  @ApiResponse({ status: 404, description: NO_SUCH_REPORT, content: PROBLEM })
  async languages(@Param('id', ParseUUIDPipe) id: string): Promise<ExportLanguagesResponseDto> {
    return new ExportLanguagesResponseDto(await this.exports.languages(id));
  }

  @Get('exports/:id')
  @ApiOperation({
    summary: 'One export (FR-49)',
    description: 'What S-11 watches while the file is produced — polled every five seconds while it is requested (OQ-36).',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiObjectResponse(ExportResponseDto, { status: 200, description: 'The export as it stands.' })
  @ApiResponse({ status: 404, description: NO_SUCH_EXPORT, content: PROBLEM })
  async find(@Param('id', ParseUUIDPipe) id: string): Promise<ExportResponseDto> {
    return new ExportResponseDto(await this.exports.find(id));
  }

  @Get('exports/:id/file')
  @ApiOperation({
    summary: 'The export’s file, exactly as it was produced (UC-44; FR-53)',
    description:
      'The stored file, byte for byte, never regenerated — and never refused for the plan the organization is on ' +
      '(FR-104). Answered as itself, not inside the response envelope.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiProduces(...Object.values(EXPORT_MEDIA_TYPE))
  @ApiResponse({ status: 200, description: 'The file.' })
  @ApiResponse({ status: 404, description: NO_SUCH_EXPORT, content: PROBLEM })
  @ApiResponse({
    status: 409,
    description: 'The export is still being produced, or failed (problem type export-file-unavailable).',
    content: PROBLEM,
  })
  @Header('Cache-Control', 'private, no-store')
  @Header('X-Content-Type-Options', 'nosniff')
  async file(@Param('id', ParseUUIDPipe) id: string): Promise<StreamableFile> {
    const { record, body, fileName } = await this.exports.file(id);
    return new StreamableFile(body, {
      type: EXPORT_MEDIA_TYPE[record.format],
      disposition: attachmentDisposition(fileName),
      length: body.length,
    });
  }
}
