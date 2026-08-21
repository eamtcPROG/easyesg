import { Injectable } from '@nestjs/common';
import { SOURCE_LOCALE } from '@easyesg/i18n';
import { requestContext } from '@api/infrastructure/persistence/request-context';
import type { Account } from '../models/account.model';
import { RegisterAccount, type RegisterAccountCommand } from '../use-cases/register-account.use-case';
import {
  RequestPasswordReset,
  type RequestPasswordResetCommand,
} from '../use-cases/request-password-reset.use-case';
import {
  ResendVerificationEmail,
  type ResendVerificationEmailCommand,
} from '../use-cases/resend-verification-email.use-case';
import { ResetPassword, type ResetPasswordCommand } from '../use-cases/reset-password.use-case';
import { VerifyEmail, type VerifyEmailCommand } from '../use-cases/verify-email.use-case';

/**
 * A use case's command minus the fields THIS layer supplies from ambient request context.
 *
 * Derived rather than hand-written, so the two can never disagree: adding a field to a command
 * adds it here, and a caller that must now provide it stops compiling — which is the point. It
 * also documents, in the type, exactly which inputs a caller is not expected to know: `locale`
 * comes from the negotiated `Accept-Language` (OQ-46) and `clientIp` from the socket, and a
 * controller has no business passing either.
 */
type AccountServiceInput<C> = Omit<C, 'locale' | 'clientIp'>;

/**
 * The module's service — the seam between controllers and use cases (house rule, added 20 Aug
 * 2026 with task 19's review: **a controller never calls a use case; it calls the module's
 * service, which orchestrates use cases**). This is the iftamaster layout the root CLAUDE.md
 * names — `controllers/` thin, `services/` orchestration, `use-cases/` single flows — applied
 * to the first module that has flows to apply it to.
 *
 * The split gives each layer one kind of knowledge:
 *
 *  - the **controller** knows transport: routes, status codes, request/response DTOs, OpenAPI;
 *  - this **service** is the Nest-aware application seam: it may inject, read ambient request
 *    context, and compose several use cases into one operation;
 *  - a **use case** is one `use_cases.md` flow, framework-free, testable with closures.
 *
 * Resolving the registration locale lives here and not in the controller for that reason: which
 * language the account is seeded with (OQ-46 → FR-169) is an application decision read from
 * ambient context, not a fact about HTTP — a queued or scripted caller of this service gets the
 * same behaviour without a controller in sight.
 *
 * Two of the three methods are single-use-case orchestrations today, which is the honest minimum
 * rather than the warned-against pass-through: the seam is the rule, and it is where task 21's
 * sign-in (session issue + lockout counters) and FR-6's reset (token consume + session
 * invalidation) will compose more than one flow without the controller growing a second caller.
 */
@Injectable()
export class AccountService {
  constructor(
    private readonly registerAccount: RegisterAccount,
    private readonly verifyEmail: VerifyEmail,
    private readonly resendVerificationEmail: ResendVerificationEmail,
    private readonly requestPasswordResetUseCase: RequestPasswordReset,
    private readonly resetPasswordUseCase: ResetPassword,
  ) {}

  register(input: AccountServiceInput<RegisterAccountCommand>): Promise<Account> {
    return this.registerAccount.execute({
      ...input,
      // The locale negotiated for this request (OQ-46) — the only evidence of preference that
      // exists before the user has seen a settings screen. Persisted on the account because
      // FR-169 resolves email language per recipient from their record; the worker sending the
      // verification message has no request to negotiate from.
      locale: requestContext()?.locale ?? SOURCE_LOCALE,
    });
  }

  verify(input: AccountServiceInput<VerifyEmailCommand>): Promise<Account> {
    return this.verifyEmail.execute(input);
  }

  resend(input: AccountServiceInput<ResendVerificationEmailCommand>): Promise<void> {
    return this.resendVerificationEmail.execute(input);
  }

  requestPasswordReset(
    input: AccountServiceInput<RequestPasswordResetCommand>,
  ): Promise<void> {
    return this.requestPasswordResetUseCase.execute({
      ...input,
      // The request's address, for §12.5.6's per-(IP, account) window — ambient context resolved
      // here for the registration-locale reason above.
      clientIp: requestContext()?.clientIp,
    });
  }

  resetPassword(input: AccountServiceInput<ResetPasswordCommand>): Promise<void> {
    return this.resetPasswordUseCase.execute(input);
  }
}
