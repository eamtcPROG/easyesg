import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiListResponse } from '@api/app/decorators/api-envelope.decorator';
import { AccountMembershipResponseDto } from '../dto/account-membership.response.dto';
import { MembershipService } from '../services/membership.service';
import { RequiresAccount } from '../decorators/requires-account.decorator';

/**
 * `/api/v1/memberships` — the caller's own memberships (UC-16's view half, FR-12).
 *
 * **The sibling of `/members`, and the pair is the whole naming decision.** `/members` is *this
 * organization's people*, gated to its administrator; `/memberships` is *my organizations*,
 * available to anyone signed in. Task 25.2 left this name free on purpose. They are not two views
 * of one resource: one is read with a tenant bound and one before any tenant exists, which is why
 * they have different stores, different gates and different shapes.
 *
 * There is no `POST` and no `PUT` here. Joining an organization is accepting an invitation (UC-15,
 * task 26.2) or creating one (UC-49, task 29); *switching* the active organization is the global
 * -tier switcher's, which `design_spec.md` OQ-6 assigned to task 30.1 and which writes the session
 * rather than this collection.
 */
@ApiTags('identity')
@Controller('memberships')
@RequiresAccount()
export class MembershipsController {
  constructor(private readonly membershipService: MembershipService) {}

  @Get()
  @ApiOperation({
    summary: 'List the organizations the signed-in account belongs to',
    description:
      'Every organization the caller is an active member of, with the role held in each and the ' +
      'organization’s name for display. An empty list is a normal answer — a verified account ' +
      'holds no membership until it creates an organization or accepts an invitation — and it is ' +
      'what sends a new user to create their first one.',
  })
  @ApiListResponse(AccountMembershipResponseDto, {
    status: 200,
    description: 'The caller’s memberships, ordered by organization name.',
  })
  @ApiResponse({
    status: 401,
    description: 'No signed-in account (problem type authentication-required).',
    content: { 'application/problem+json': {} },
  })
  async list(): Promise<AccountMembershipResponseDto[]> {
    return (await this.membershipService.listOwn()).map(
      (membership) => new AccountMembershipResponseDto(membership),
    );
  }
}
