import { Body, Controller, HttpCode, Put } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { NO_CONTENT_RESPONSE } from '@api/app/interceptors/global-response.interceptor';
import { RequiresAccount } from '../decorators/requires-account.decorator';
import { SwitchActiveOrganizationRequestDto } from '../dto/switch-active-organization.request.dto';
import { MembershipService } from '../services/membership.service';

/**
 * `/api/v1/session/organization` — UC-16's switch half (FR-12; task 83.1).
 *
 * **The path names what changes: the session.** Chosen with task 30.1 over
 * `POST /memberships/{id}/activation`, which names the membership when nothing about it changes, and
 * over `PATCH /session`, a body that would grow where there is one mutable property
 * (`architecture.md` §12.5.6's task-30.1 row). It stays off the unauthenticated `/auth` surface, and it
 * lives in `identity/membership` because that module owns FR-12 — the rule it applies is a
 * membership's, the column it writes merely sits on the session.
 *
 * **`@RequiresAccount`, not `@RequiresRole`**: the caller it exists for holds several memberships and
 * has chosen none, so no role resolves until it has been called — `@RequiresRole` would refuse exactly
 * that person, as it would on `GET /memberships`.
 *
 * **No entitlement gate, and none is owed** (`apps/api/CLAUDE.md`, *Before you add a route*): which of its own
 * organizations a session acts for spends nothing a plan meters, and the caller it exists for has no
 * organization resolved whose plan a key could be read against.
 *
 * `PUT` because it is idempotent: choosing the organization already active changes nothing.
 */
@ApiTags('identity')
@Controller('session/organization')
@RequiresAccount()
export class SessionOrganizationController {
  constructor(private readonly membershipService: MembershipService) {}

  @Put()
  @HttpCode(204)
  @ApiOperation({
    summary: 'Choose the organization this session acts for',
    description:
      'From the next request on, every organization-scoped read and write, and the role they are ' +
      'judged against, are those of the organization chosen. Only this session changes: another ' +
      'device signed in to the same account keeps its own choice. Nothing is reissued, because the ' +
      'organization is read from the session on every request and never carried in a token.',
  })
  @ApiResponse({ status: 204, description: 'The session acts for that organization.' })
  @ApiResponse({
    status: 401,
    description: 'No signed-in account (problem type authentication-required).',
    content: { 'application/problem+json': {} },
  })
  @ApiResponse({
    status: 404,
    description:
      'The signed-in account is not an active member of that organization — it never was, its ' +
      'access was removed, or no organization has that id; one answer for all three (problem type ' +
      'not-found). The session keeps the organization it had.',
    content: { 'application/problem+json': {} },
  })
  async choose(
    @Body() body: SwitchActiveOrganizationRequestDto,
  ): Promise<typeof NO_CONTENT_RESPONSE> {
    await this.membershipService.switchActive(body);
    return NO_CONTENT_RESPONSE;
  }
}
