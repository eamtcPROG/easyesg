import { Injectable } from '@nestjs/common';
import type { AdminRosterRow } from '../models/admin-roster.model';
import {
  ChangeAdminAccountStatus,
  type ChangeAdminAccountStatusCommand,
} from '../use-cases/change-admin-account-status.use-case';
import { ListAdminRoster } from '../use-cases/list-admin-roster.use-case';
import {
  ReleaseAdminLockout,
  type ReleaseAdminLockoutCommand,
} from '../use-cases/release-admin-lockout.use-case';
import { requestOperatorId } from './request-operator';

/**
 * A-08's account half (task 67.4; UC-87) — the roster and each account's lifecycle. The application
 * seam between the controller and the use cases, and the place the acting operator is resolved from
 * the request rather than taken from the caller (`request-operator.ts`).
 */
@Injectable()
export class AdminAccountsService {
  constructor(
    private readonly listRoster: ListAdminRoster,
    private readonly changeStatusUseCase: ChangeAdminAccountStatus,
    private readonly releaseLockoutUseCase: ReleaseAdminLockout,
  ) {}

  roster(): Promise<AdminRosterRow[]> {
    return this.listRoster.execute({ requesterId: requestOperatorId() });
  }

  changeStatus(input: Omit<ChangeAdminAccountStatusCommand, 'actingAccountId'>): Promise<void> {
    return this.changeStatusUseCase.execute({ ...input, actingAccountId: requestOperatorId() });
  }

  releaseLockout(input: ReleaseAdminLockoutCommand): Promise<void> {
    return this.releaseLockoutUseCase.execute(input);
  }
}
