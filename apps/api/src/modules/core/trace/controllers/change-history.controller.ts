import { Controller, DefaultValuePipe, Get, Param, ParseIntPipe, ParseUUIDPipe, Query, Req, UseInterceptors } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { DEFAULT_ON_PAGE } from '@api/app/constants/pagination.constants';
import { ApiListResponse } from '@api/app/decorators/api-envelope.decorator';
import { RequestListDto } from '@api/app/dto/request-list.dto';
import { ResultListDto } from '@api/app/dto/result-list.dto';
import { ListQueryInterceptor } from '@api/app/interceptors/list-query.interceptor';
import { NO_SUCH_REPORT } from '@api/modules/core/disclosure/errors/report.errors';
import { RequiresRole } from '@api/modules/identity/membership/decorators/requires-role.decorator';
import { MEMBERSHIP_ROLE } from '@api/modules/identity/membership/models/membership.model';
import { ChangeEntryDto } from '../dto/change-history.dto';
import { HISTORY_SUBJECT, type HistoryPage, type HistorySubject } from '../models/change-history.model';
import { TraceService } from '../services/trace.service';

const PROBLEM = { 'application/problem+json': {} };

const PAGE_DESCRIPTION = '1-based.';
const ON_PAGE_DESCRIPTION = `Entries per page, ${DEFAULT_ON_PAGE} unless given. \`-1\` (every entry) is refused.`;
const LIST_DESCRIPTION =
  'One page of the history, newest first. Each entry is one change: when, by whom, and each field it moved from what ' +
  'to what, every value in the reader’s language.';

/** An entity's and a field's history: an editor's and the Organization Administrator's (FR-54's actors; 182/22). */
const WRITING_MEMBERS = [MEMBERSHIP_ROLE.EDITOR, MEMBERSHIP_ROLE.ORGANIZATION_ADMINISTRATOR] as const;

/**
 * UC-47's three reads (task 84.1; §12.5.6's task-84 row (a)) — a subject's change history, a page of it, newest first:
 * the organization's, one entity's, one disclosure field's. A view-only member is refused 403 `insufficient-role`
 * (182/22), which is FR-54's actors line. **The organization's history is the Organization Administrator's alone**, as
 * `GET /organization` is: it states the same settings, and the Contributor has none of them (actors.md, D-2).
 */
@ApiTags('trace')
@Controller()
export class ChangeHistoryController {
  constructor(private readonly trace: TraceService) {}

  @Get('organization/history')
  @RequiresRole(MEMBERSHIP_ROLE.ORGANIZATION_ADMINISTRATOR)
  // An instance, not the class: see `AccessController` for what the class does to the application's boot.
  @UseInterceptors(new ListQueryInterceptor())
  @ApiOperation({
    summary: 'The organization’s change history (UC-47)',
    description: 'Its name, country and contact details as each was changed (FR-54), reached from S-15’s attribution line.',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, description: PAGE_DESCRIPTION })
  @ApiQuery({ name: 'onpage', required: false, type: Number, description: ON_PAGE_DESCRIPTION })
  @ApiListResponse(ChangeEntryDto, { status: 200, description: LIST_DESCRIPTION })
  async organization(@Req() request: Request): Promise<ResultListDto<ChangeEntryDto>> {
    return this.page({ kind: HISTORY_SUBJECT.ORGANIZATION }, request);
  }

  @Get('entities/:id/history')
  @RequiresRole(...WRITING_MEMBERS)
  @UseInterceptors(new ListQueryInterceptor())
  @ApiOperation({
    summary: 'A reporting entity’s change history (UC-47)',
    description:
      'The entity’s own fields — its name, legal form, activities, identifiers, address, report contact, basis and ' +
      'standing — as each was changed (FR-54), reached from S-13’s record.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: PAGE_DESCRIPTION })
  @ApiQuery({ name: 'onpage', required: false, type: Number, description: ON_PAGE_DESCRIPTION })
  @ApiListResponse(ChangeEntryDto, { status: 200, description: LIST_DESCRIPTION })
  @ApiResponse({ status: 404, description: 'No such entity in the active organization.', content: PROBLEM })
  async entity(@Param('id', ParseUUIDPipe) id: string, @Req() request: Request): Promise<ResultListDto<ChangeEntryDto>> {
    return this.page({ kind: HISTORY_SUBJECT.ENTITY, entityId: id }, request);
  }

  @Get('reports/:id/values/:elementKey/history')
  @RequiresRole(...WRITING_MEMBERS)
  @UseInterceptors(new ListQueryInterceptor())
  @ApiOperation({
    summary: 'One disclosure field’s change history (UC-47)',
    description:
      'Its answer as each change left it, with where it came from — typed, carried forward, calculated or overridden ' +
      '(FR-54), reached from the field on S-07. A field never answered has no history yet.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiParam({ name: 'elementKey', description: 'The field’s element.', example: 'NumberOfEmployees' })
  @ApiQuery({
    name: 'dimensionKey',
    required: false,
    type: String,
    description: 'An axis member; empty, the default, for an undimensioned element.',
  })
  @ApiQuery({
    name: 'ordinal',
    required: false,
    type: Number,
    description: 'Position within a repeating group; 0, the default, where there is none.',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, description: PAGE_DESCRIPTION })
  @ApiQuery({ name: 'onpage', required: false, type: Number, description: ON_PAGE_DESCRIPTION })
  @ApiListResponse(ChangeEntryDto, { status: 200, description: LIST_DESCRIPTION })
  @ApiResponse({ status: 404, description: NO_SUCH_REPORT, content: PROBLEM })
  async value(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('elementKey') elementKey: string,
    @Query('dimensionKey', new DefaultValuePipe('')) dimensionKey: string,
    @Query('ordinal', new DefaultValuePipe(0), ParseIntPipe) ordinal: number,
    @Req() request: Request,
  ): Promise<ResultListDto<ChangeEntryDto>> {
    return this.page({ kind: HISTORY_SUBJECT.VALUE, reportId: id, elementKey, dimensionKey, ordinal }, request);
  }

  private async page(subject: HistorySubject, request: Request): Promise<ResultListDto<ChangeEntryDto>> {
    const page: HistoryPage & { readonly take: number } = await this.trace.history({
      subject,
      list: request.requestList ?? new RequestListDto(),
    });
    return new ResultListDto({
      objects: page.entries.map((entry) => new ChangeEntryDto(entry)),
      total: page.total,
      totalpages: Math.max(1, Math.ceil(page.total / page.take)),
    });
  }
}
