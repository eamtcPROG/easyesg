import { Controller, Get, Req, UseInterceptors } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { ApiListResponse } from '@api/app/decorators/api-envelope.decorator';
import { DEFAULT_ON_PAGE } from '@api/app/constants/pagination.constants';
import { ResultListDto } from '@api/app/dto/result-list.dto';
import { RequestListDto } from '@api/app/dto/request-list.dto';
import { ListQueryInterceptor } from '@api/app/interceptors/list-query.interceptor';
import { RequiresRole } from '@api/modules/identity/membership/decorators/requires-role.decorator';
import { MEMBERSHIP_ROLE } from '@api/modules/identity/membership/models/membership.model';
import { AccessRowResponseDto } from '../dto/access-row.response.dto';
import { AccessService } from '../services/access.service';

/**
 * S-16's list, as one resource over two collections (UC-59, FR-56; task 131).
 *
 * **Why a third route rather than parameters on the two that exist.** `GET /members` and
 * `GET /invitations` are the two collections and stay exactly as they are — each is the resource its
 * own writes act on. What they cannot be is *paged together*: page 2 of members unioned with page 2
 * of invitations is not page 2 of the union, and an order spanning both cannot be resolved from two
 * separately-ordered responses. So the union is a resource of its own, computed in one statement.
 *
 * **Read-only, and deliberately so.** Every action a row offers belongs to the collection it came
 * from — a role change and a removal are `/members/{id}`, a resend and a revoke are
 * `/invitations/{id}`. A write here would be a second door onto rows that already have one, and the
 * id this route publishes is unique only within its own half, which is why callers must qualify it
 * with `kind`.
 *
 * **The compact list format, opted into per handler** (§6.8). `ListQueryInterceptor` parses
 * `?filters=`, `?order=`, `?page=` and `?onpage=` into `req.requestList`; `toAccessQuery` narrows
 * that to what this screen can be asked and falls back rather than refusing, because a stale or
 * hand-edited query string should show the list and not a screen about the query string.
 *
 * **Not bounded**: `onpage=-1` is refused. The set is seat-limited today, and a route that can be
 * asked for everything is one an entitlement change turns into an outage with nobody editing it.
 */
@ApiTags('identity')
@Controller('access')
@RequiresRole(MEMBERSHIP_ROLE.ORGANIZATION_ADMINISTRATOR)
export class AccessController {
  constructor(private readonly access: AccessService) {}

  @Get()
  // **An instance, not the class.** `ListQueryInterceptor`'s constructor takes `(bounded,
  // maxOnPage)` with defaults, so handing Nest the class makes it try to inject two primitives and
  // the application does not boot — `Nest can't resolve dependencies of the ListQueryInterceptor
  // (?, Object)`. Its own docblock said to pass the class; this is the first route to use it, so
  // the instruction had never been run. Corrected there too (task 131).
  @UseInterceptors(new ListQueryInterceptor())
  @ApiOperation({
    summary: 'List everyone with access to the active organization, members and invitations as one',
    description:
      'Answers "who can see our ESG data" as a single ordered list across active memberships and ' +
      'pending invitations, with the filter, the order and the page applied to the merged set. ' +
      'The standing is derived server-side from now(), so a row cannot be admitted by the filter ' +
      'as live and rendered as expired on the same request.',
  })
  @ApiQuery({
    name: 'filters',
    required: false,
    description:
      'Compact facets: `role,<role>` and `standing,<standing>`, pipe-separated. A value outside ' +
      'the published enum, or a field this route does not define, is ignored rather than refused.',
  })
  @ApiQuery({
    name: 'order',
    required: false,
    description:
      'One ordering: `<person|role|standing|activity>,<asc|desc>`. Defaults to `activity,desc` — ' +
      'an administrator opening this screen is looking at who is here now. Role and standing order ' +
      'by rank rather than alphabetically: widest access first, needing-attention first.',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, description: '1-based.' })
  @ApiQuery({
    name: 'onpage',
    required: false,
    type: Number,
    description: 'Rows per page. `-1` (all rows) is refused on this route.',
  })
  @ApiListResponse(AccessRowResponseDto, {
    status: 200,
    description:
      'One page of the merged list. `total` counts rows surviving the filter and is what pages ' +
      'are counted from; `unfiltered` counts rows before it, which is what tells an empty result ' +
      'whether nobody has been invited yet or the filter matched nobody.',
  })
  @ApiResponse({
    status: 403,
    description:
      'The caller holds no membership in an active organization (problem type ' +
      'membership-required), or holds one in a role that is not organization_administrator ' +
      '(problem type insufficient-role).',
    content: { 'application/problem+json': {} },
  })
  async list(@Req() request: Request): Promise<ResultListDto<AccessRowResponseDto>> {
    // The interceptor always sets this on a handler it decorates; the fallback is what keeps the
    // route honest if the decorator is ever removed, rather than reading `undefined` as "no filters"
    // and silently serving an unfiltered first page.
    const query = this.access.narrow(request.requestList ?? new RequestListDto());
    const page = await this.access.list(query);

    return new ResultListDto({
      objects: page.rows.map((row) => new AccessRowResponseDto(row)),
      total: page.matched,
      totalpages: Math.max(1, Math.ceil(page.matched / query.take)),
      unfiltered: page.total,
    });
  }
}
