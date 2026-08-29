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
 * task 26.2) or creating one (UC-49, task 29); *switching* the active organization writes the
 * session rather than this collection, and is `PUT /api/v1/session/organization` — task 83, split
 * out of task 30.1 on 29 Aug 2026 so the global tier could ship without waiting on a new route.
 * `design_spec.md` OQ-6 assigns the behaviour to the switcher; this collection only reports which
 * membership the current request resolved to, in `active`.
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
      'Every organization the caller is an active member of, with the role held in each, the ' +
      'organization’s name for display, and which one this request is acting for. An empty list ' +
      'is a normal answer — a verified account holds no membership until it creates an ' +
      'organization or accepts an invitation — and it is what sends a new user to create their ' +
      'first one. A list in which no entry is active is also normal: it is an account holding ' +
      'several memberships that has stated no preference, and it is what the organization ' +
      'switcher exists to resolve.',
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
