import { Controller, Get, Header, Param, ParseEnumPipe, ParseUUIDPipe, Query, StreamableFile } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiParam, ApiProduces, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { LOCALES, type Locale } from '@easyesg/i18n';
import { NO_SUCH_REPORT } from '@api/modules/core/disclosure/errors/report.errors';
import { RequiresRole } from '@api/modules/identity/membership/decorators/requires-role.decorator';
import { MEMBERSHIP_ROLE } from '@api/modules/identity/membership/models/membership.model';
import { PREVIEW_CONTENT_SECURITY_POLICY, PREVIEW_LOCALES } from '../constants/preview.constants';
import { PreviewService } from '../services/preview.service';

/**
 * `GET /api/v1/reports/:id/preview` — UC-41: the report as its document, in the language asked for, without generating
 * a file (task 43.1; FR-48; §12.5.6's task-43 row, which closed OQ-38).
 *
 * **It answers the document itself, as `text/html`**, not an envelope: S-10 frames it, and task 44's job renders the
 * same markup for Chromium. A `StreamableFile` is how a body leaves the envelope interceptor, the re-download's
 * bypass. **An editor or the OA previews; a view-only member is refused** (182/22).
 *
 * **Recorded deferral: no entitlement gate until task 54**, like its neighbours — previewing is not exporting.
 */
@ApiTags('export')
@Controller('reports')
export class PreviewController {
  constructor(private readonly previews: PreviewService) {}

  @Get(':id/preview')
  @RequiresRole(MEMBERSHIP_ROLE.EDITOR, MEMBERSHIP_ROLE.ORGANIZATION_ADMINISTRATOR)
  @ApiOperation({
    summary: 'The report as its document, without generating a file',
    description:
      'The whole document — cover, contents, omissions and findings, one page per module, provenance — as one HTML ' +
      'page with its styles and fonts inside it and no script, in the language asked for, which need not be the ' +
      'interface’s (FR-52). Nothing is written: no file and no export record (FR-48).',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiQuery({ name: 'locale', enum: LOCALES, required: true, description: 'The document’s language.' })
  @ApiProduces('text/html')
  @ApiOkResponse({
    description: 'The document.',
    content: { 'text/html': { schema: { type: 'string' } } },
  })
  @ApiResponse({ status: 400, description: 'No language, or one the platform does not publish in, was asked for.' })
  @ApiResponse({ status: 404, description: NO_SUCH_REPORT })
  @Header('Cache-Control', 'no-store')
  @Header('Content-Security-Policy', PREVIEW_CONTENT_SECURITY_POLICY)
  @Header('X-Content-Type-Options', 'nosniff')
  async preview(
    @Param('id', ParseUUIDPipe) reportId: string,
    @Query('locale', new ParseEnumPipe(PREVIEW_LOCALES)) locale: Locale,
  ): Promise<StreamableFile> {
    const document = await this.previews.preview({ reportId, locale });
    return new StreamableFile(Buffer.from(document, 'utf8'), { type: 'text/html; charset=utf-8' });
  }
}
