import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiObjectResponse } from '@api/app/decorators/api-envelope.decorator';
import { RequiresRole } from '@api/modules/identity/membership/decorators/requires-role.decorator';
import { MEMBERSHIP_ROLE } from '@api/modules/identity/membership/models/membership.model';
import { NO_SUCH_REPORT } from '@api/modules/core/disclosure/errors/report.errors';
import { PriorPeriodResponseDto } from '../dto/prior-period.dto';
import { ComparativesService } from '../services/comparatives.service';

/**
 * `/api/v1/reports/:id/prior-period` — last year's answers for this year's fields (UC-45;
 * FR-45, FR-46).
 *
 * **A second controller at the `reports` prefix**, on the precedent `InvitationsController` and
 * `InvitationBearerController` set (task 26.2): the URL belongs to the report resource, and the
 * behaviour belongs to `core/comparatives`, which §17.5 gives FR-45 … FR-47. Folding it into
 * `ReportsController` would put a comparative's logic in the module that owns FR-24 … FR-32.
 *
 * **This module was scaffolded as owning no HTTP surface, and that is amended here** (§12.5.6).
 * architecture.md's component table records its *storage* as "— (reads across periods)", which is
 * about a table and not about a route. The route has to exist somewhere in this tier: task 36.14 is
 * `web`-scoped, and comparability is computed from `TAXONOMY_REGISTRY`, an api port the browser has
 * no way to ask.
 *
 * **Read-only, and open to every member** — the same rule `ReportsController`'s reads follow, for
 * FR-25's reason: a view-only member sees the same entries, which includes what last year said.
 *
 * **No entitlement gate until task 54**, like its neighbour, and recorded here rather than assumed.
 */
@ApiTags('report')
@Controller('reports')
export class ComparativesController {
  constructor(private readonly comparatives: ComparativesService) {}

  @Get(':id/prior-period')
  @RequiresRole(
    MEMBERSHIP_ROLE.EDITOR,
    MEMBERSHIP_ROLE.ORGANIZATION_ADMINISTRATOR,
    MEMBERSHIP_ROLE.VIEWER,
  )
  @ApiOperation({
    summary: 'The prior period’s answers for this report',
    description:
      'Resolves the prior period from the linkage rather than from the caller (FR-45), and answers ' +
      'each value with whether it is comparable across the two pinned taxonomy versions (FR-46). ' +
      'Where there is no comparative, `availability` says which of the two reasons applies.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiObjectResponse(PriorPeriodResponseDto, {
    status: 200,
    description: 'The prior period’s answers, each with its comparability verdict.',
  })
  @ApiResponse({ status: 404, description: NO_SUCH_REPORT })
  async priorPeriod(
    @Param('id', ParseUUIDPipe) reportId: string,
  ): Promise<PriorPeriodResponseDto> {
    return new PriorPeriodResponseDto(await this.comparatives.priorPeriod({ reportId }));
  }
}
