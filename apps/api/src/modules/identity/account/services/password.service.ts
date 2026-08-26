import { Injectable } from '@nestjs/common';
import { requestContext } from '@api/infrastructure/persistence/request-context';
import { AuthenticationRequiredError } from '@api/modules/identity/membership/errors/membership.errors';
import {
  ChangePassword,
  type ChangePasswordCommand,
  type PasswordChanged,
} from '../use-cases/change-password.use-case';

/**
 * The seam between `PasswordController` and `ChangePassword` (house rule: controllers call
 * services, services call use cases).
 *
 * It resolves **two** ambient values, and the second is what makes FR-7's "other" possible: the
 * acting account, and the **session this request is acting on**. Both come from the request context
 * where `AuthGuard` wrote them after resolving the bearer token — never from the body. A session id
 * arriving from the wire would let a caller nominate which session to spare, which is the same
 * class of defect as an account id in the path and considerably worse: it would let someone keep a
 * session they do not hold.
 */
@Injectable()
export class PasswordService {
  constructor(private readonly changePassword: ChangePassword) {}

  change(
    input: Omit<ChangePasswordCommand, 'accountId' | 'sessionId' | 'clientIp' | 'terminateOtherSessions'> & {
      readonly terminateOtherSessions?: boolean;
    },
  ): Promise<PasswordChanged> {
    const context = requestContext();
    // `AuthGuard` closes the surface by default, so reaching here without either is a wiring
    // defect rather than a request — refused rather than asserted, so a guard regression is a 401
    // and not a `TypeError` three layers down.
    if (context?.actorId === undefined || context.sessionId === undefined) {
      throw new AuthenticationRequiredError();
    }

    return this.changePassword.execute({
      ...input,
      // The DTO's field is optional; FR-7's election defaults to NOT terminating, because the
      // requirement says *where the user elects it*.
      terminateOtherSessions: input.terminateOtherSessions ?? false,
      accountId: context.actorId,
      sessionId: context.sessionId,
      clientIp: context.clientIp,
    });
  }
}
