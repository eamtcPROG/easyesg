import { Injectable } from '@nestjs/common';
import { requestContext } from '@api/infrastructure/persistence/request-context';
import type { AdminCredentialState, AdminPasswordChanged } from '../models/admin-credentials.model';
import {
  BeginAdminReenrolment,
  type BeginAdminReenrolmentCommand,
} from '../use-cases/begin-admin-reenrolment.use-case';
import {
  ChangeAdminPassword,
  type ChangeAdminPasswordCommand,
} from '../use-cases/change-admin-password.use-case';
import {
  ConfirmAdminReenrolment,
  type ConfirmAdminReenrolmentCommand,
} from '../use-cases/confirm-admin-reenrolment.use-case';
import {
  IssueAdminRecoveryCodes,
  type IssueAdminRecoveryCodesCommand,
} from '../use-cases/issue-admin-recovery-codes.use-case';
import { ReadAdminCredentials } from '../use-cases/read-admin-credentials.use-case';
import type { AdminEnrolmentOffer } from '../use-cases/stage-admin-enrolment.use-case';
import { requestOperatorId, requestOperatorSessionId } from './request-operator';

/**
 * A-19's application seam (task 144; UC-212). **The operator is the request's, never the body's** —
 * `request-operator.ts`'s rule, which here is the whole of the authorization: the routes admit every
 * operator, and each acts only on the account its own session names.
 *
 * **It forwards the client address to all four writes**, because they spend one window keyed on it — the
 * `TotpService` lesson `apps/api/CLAUDE.md` records, where one route dropped it and one budget quietly
 * became two keys.
 */
@Injectable()
export class AdminCredentialsService {
  constructor(
    private readonly readUseCase: ReadAdminCredentials,
    private readonly changePasswordUseCase: ChangeAdminPassword,
    private readonly beginReenrolmentUseCase: BeginAdminReenrolment,
    private readonly confirmReenrolmentUseCase: ConfirmAdminReenrolment,
    private readonly issueRecoveryCodesUseCase: IssueAdminRecoveryCodes,
  ) {}

  state(): Promise<AdminCredentialState> {
    return this.readUseCase.execute({ accountId: requestOperatorId() });
  }

  changePassword(
    input: Omit<ChangeAdminPasswordCommand, 'accountId' | 'clientIp' | 'sessionId'>,
  ): Promise<AdminPasswordChanged> {
    return this.changePasswordUseCase.execute({
      ...input,
      ...this.ambient(),
      sessionId: requestOperatorSessionId(),
    });
  }

  beginReenrolment(
    input: Omit<BeginAdminReenrolmentCommand, 'accountId' | 'clientIp'>,
  ): Promise<AdminEnrolmentOffer> {
    return this.beginReenrolmentUseCase.execute({ ...input, ...this.ambient() });
  }

  confirmReenrolment(input: Omit<ConfirmAdminReenrolmentCommand, 'accountId' | 'clientIp'>): Promise<void> {
    return this.confirmReenrolmentUseCase.execute({ ...input, ...this.ambient() });
  }

  issueRecoveryCodes(
    input: Omit<IssueAdminRecoveryCodesCommand, 'accountId' | 'clientIp'>,
  ): Promise<readonly string[]> {
    return this.issueRecoveryCodesUseCase.execute({ ...input, ...this.ambient() });
  }

  /** The operator and their address, resolved once per call and in one place for all four writes. */
  private ambient(): Pick<BeginAdminReenrolmentCommand, 'accountId' | 'clientIp'> {
    return { accountId: requestOperatorId(), clientIp: requestContext()?.clientIp };
  }
}
