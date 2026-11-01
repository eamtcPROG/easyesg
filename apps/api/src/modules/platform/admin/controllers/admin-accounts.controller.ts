import { Controller, Get, HttpCode, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiListResponse } from '@api/app/decorators/api-envelope.decorator';
import { AUDIT_TARGET, AuditAction } from '@api/app/decorators/audit-action.decorator';
import { NO_CONTENT_RESPONSE } from '@api/app/interceptors/global-response.interceptor';
import { AUDIT_ACTION } from '@api/modules/platform/audit/models/audit-action.model';
import { RequiresAdminRole } from '../decorators/requires-admin-role.decorator';
import { ADMIN_ACCOUNT_CHANGE } from '../models/admin-account-change.model';
import { AdminRosterRowResponseDto } from '../dto/admin-roster-row.response.dto';
import { ADMIN_ROLE } from '../models/admin-session.model';
import { AdminAccountsService } from '../services/admin-accounts.service';

const PROBLEM = { 'application/problem+json': {} };
const ACCOUNT_ID = 'accountId';
const BY_ACCOUNT = { from: AUDIT_TARGET.PARAM, name: ACCOUNT_ID } as const;

const SIGNED_OUT = {
  status: 401,
  description:
    'No usable operator session (problem type authentication-required), or its lifetimes ran out ' +
    '(problem type session-expired).',
  content: PROBLEM,
} as const;

const NOT_PLATFORM_ADMINISTRATOR = {
  status: 403,
  description:
    'The operator’s role is not platform_administrator (problem type insufficient-role), or the ' +
    'request came from an origin other than the console’s.',
  content: PROBLEM,
} as const;

const NO_SUCH_ACCOUNT = {
  status: 404,
  description: 'No operator account has this id (problem type not-found).',
  content: PROBLEM,
} as const;

const ACCOUNT_PARAM = { name: ACCOUNT_ID, format: 'uuid', description: 'The operator account.' } as const;

/**
 * `/api/v1/admin/accounts` — A-08's account table and each account's lifecycle (task 67.4; UC-87,
 * FR-80; `architecture.md` §12.5.6's task-67.4 row).
 *
 * **A Platform Administrator's, over both realms' accounts** (`actors.md` OQ-6, closed 13 Sep 2026).
 * **Every write declares its audit action** and `AuditInterceptor` writes it once the write succeeds —
 * one row per change, naming the account from the route. **Action nouns, not verbs on a resource**:
 * a suspension, a reactivation, a removal and a release are events with their own refusals, and a
 * `PATCH` of a status field would hide which of them was asked for from the log, the matrix and the
 * reader alike.
 */
@ApiTags('platform')
@Controller('admin/accounts')
@RequiresAdminRole(ADMIN_ROLE.PLATFORM_ADMINISTRATOR)
export class AdminAccountsController {
  constructor(private readonly accounts: AdminAccountsService) {}

  @Get()
  @ApiOperation({
    summary: 'List every operator account and every pending invitation',
    description:
      'UC-87. Accounts in both realms, removed ones included because their entries stay attributed ' +
      'to them, followed by pending invitations — each with its one-word state and its last ' +
      'sign-in or expiry. Never a credential.',
  })
  @ApiListResponse(AdminRosterRowResponseDto, {
    status: 200,
    description: 'The whole roster: operators who can act, then invitations, then removed accounts.',
  })
  @ApiResponse(SIGNED_OUT)
  @ApiResponse(NOT_PLATFORM_ADMINISTRATOR)
  async roster(): Promise<AdminRosterRowResponseDto[]> {
    return (await this.accounts.roster()).map((row) => new AdminRosterRowResponseDto(row));
  }

  @Post(`:${ACCOUNT_ID}/suspension`)
  @HttpCode(204)
  @AuditAction({ action: AUDIT_ACTION.ADMIN_ACCOUNT_SUSPENDED, target: BY_ACCOUNT })
  @ApiOperation({
    summary: 'Suspend an operator account',
    description:
      'Reversible. The account can no longer sign in, and every session it holds is refused on its ' +
      'next request. Recorded in the system audit log.',
  })
  @ApiParam(ACCOUNT_PARAM)
  @ApiResponse({ status: 204, description: 'Suspended; its sessions have ended.' })
  @ApiResponse(SIGNED_OUT)
  @ApiResponse(NOT_PLATFORM_ADMINISTRATOR)
  @ApiResponse(NO_SUCH_ACCOUNT)
  @ApiResponse({
    status: 409,
    description:
      'The account is not active, or it is the operator’s own (problem type conflict); or it is the ' +
      'last active Platform Administrator (problem type last-administrator).',
    content: PROBLEM,
  })
  async suspend(
    @Param(ACCOUNT_ID, ParseUUIDPipe) accountId: string,
  ): Promise<typeof NO_CONTENT_RESPONSE> {
    await this.accounts.changeStatus({ accountId, change: ADMIN_ACCOUNT_CHANGE.SUSPEND });
    return NO_CONTENT_RESPONSE;
  }

  @Post(`:${ACCOUNT_ID}/reactivation`)
  @HttpCode(204)
  @AuditAction({ action: AUDIT_ACTION.ADMIN_ACCOUNT_REACTIVATED, target: BY_ACCOUNT })
  @ApiOperation({
    summary: 'Reactivate a suspended operator account',
    description:
      'The account may sign in again. No session the suspension ended comes back. Recorded in the ' +
      'system audit log.',
  })
  @ApiParam(ACCOUNT_PARAM)
  @ApiResponse({ status: 204, description: 'Reactivated.' })
  @ApiResponse(SIGNED_OUT)
  @ApiResponse(NOT_PLATFORM_ADMINISTRATOR)
  @ApiResponse(NO_SUCH_ACCOUNT)
  @ApiResponse({
    status: 409,
    description: 'The account is not suspended (problem type conflict).',
    content: PROBLEM,
  })
  async reactivate(
    @Param(ACCOUNT_ID, ParseUUIDPipe) accountId: string,
  ): Promise<typeof NO_CONTENT_RESPONSE> {
    await this.accounts.changeStatus({ accountId, change: ADMIN_ACCOUNT_CHANGE.REACTIVATE });
    return NO_CONTENT_RESPONSE;
  }

  @Post(`:${ACCOUNT_ID}/removal`)
  @HttpCode(204)
  @AuditAction({ action: AUDIT_ACTION.ADMIN_ACCOUNT_REMOVED, target: BY_ACCOUNT })
  @ApiOperation({
    summary: 'Remove an operator account’s access, finally',
    description:
      'Irreversible. The account can never sign in again and cannot be restored; every entry it made ' +
      'stays attributed to it. Inviting its address again creates a new account. Recorded in the ' +
      'system audit log.',
  })
  @ApiParam(ACCOUNT_PARAM)
  @ApiResponse({ status: 204, description: 'Removed; its sessions have ended.' })
  @ApiResponse(SIGNED_OUT)
  @ApiResponse(NOT_PLATFORM_ADMINISTRATOR)
  @ApiResponse(NO_SUCH_ACCOUNT)
  @ApiResponse({
    status: 409,
    description:
      'The account is already removed, or it is the operator’s own (problem type conflict); or it is ' +
      'the last active Platform Administrator (problem type last-administrator).',
    content: PROBLEM,
  })
  async remove(
    @Param(ACCOUNT_ID, ParseUUIDPipe) accountId: string,
  ): Promise<typeof NO_CONTENT_RESPONSE> {
    await this.accounts.changeStatus({ accountId, change: ADMIN_ACCOUNT_CHANGE.REMOVE });
    return NO_CONTENT_RESPONSE;
  }

  @Post(`:${ACCOUNT_ID}/lockout-release`)
  @HttpCode(204)
  @AuditAction({ action: AUDIT_ACTION.ADMIN_ACCOUNT_LOCKOUT_RELEASED, target: BY_ACCOUNT })
  @ApiOperation({
    summary: 'Release an operator account locked after repeated failures',
    description:
      'Clears the lock and the failure count, so the operator has the whole threshold back. ' +
      'Recorded in the system audit log.',
  })
  @ApiParam(ACCOUNT_PARAM)
  @ApiResponse({ status: 204, description: 'Released.' })
  @ApiResponse(SIGNED_OUT)
  @ApiResponse(NOT_PLATFORM_ADMINISTRATOR)
  @ApiResponse(NO_SUCH_ACCOUNT)
  @ApiResponse({
    status: 409,
    description: 'The account is not locked (problem type conflict).',
    content: PROBLEM,
  })
  async releaseLockout(
    @Param(ACCOUNT_ID, ParseUUIDPipe) accountId: string,
  ): Promise<typeof NO_CONTENT_RESPONSE> {
    await this.accounts.releaseLockout({ accountId });
    return NO_CONTENT_RESPONSE;
  }
}
