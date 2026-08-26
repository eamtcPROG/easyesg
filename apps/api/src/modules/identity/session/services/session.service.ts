import { Injectable } from '@nestjs/common';
import { requestContext } from '@api/infrastructure/persistence/request-context';
import type { IssuedSession, SignInOutcome } from '../models/session.model';
import { RefreshSession, type RefreshSessionCommand } from '../use-cases/refresh-session.use-case';
import { SignIn, type SignInCommand } from '../use-cases/sign-in.use-case';
import {
  CompleteFactorChallenge,
  type CompleteFactorChallengeCommand,
} from '../use-cases/complete-factor-challenge.use-case';
import { SignOut, type SignOutCommand } from '../use-cases/sign-out.use-case';

/**
 * A command minus what this layer resolves from ambient request context — see
 * `AccountService`'s equivalent. Only `clientIp` is ambient here; the session module reads no
 * locale, because a session response carries the account's persisted preference rather than the
 * request's negotiated one (OQ-32).
 */
type SessionServiceInput<C> = Omit<C, 'clientIp'>;

/**
 * The module's service — controllers call services, services call use cases (house rule; see
 * `AccountService`, whose header carries the full argument).
 *
 * Its one piece of orchestration is ambient-context resolution, exactly the registration-locale
 * pattern: the client IP feeding §12.5.6's throttle is a fact about the request, read here so
 * the use case stays a function of its command — a queued or scripted caller simply has no IP
 * and degrades to the shared bucket, which `auth-throttle.ts` already accounts for.
 */
@Injectable()
export class SessionService {
  constructor(
    private readonly signInUseCase: SignIn,
    private readonly completeFactorUseCase: CompleteFactorChallenge,
    private readonly refreshSessionUseCase: RefreshSession,
    private readonly signOutUseCase: SignOut,
  ) {}

  /**
   * Two shapes since task 27.3 — a session, or a factor challenge (UC-194). The service passes the
   * outcome through untouched: deciding which of them a route answers is the controller's, and
   * collapsing them here would put a wire concern in the layer that exists to keep wire concerns
   * out of the use case.
   */
  signIn(input: SessionServiceInput<SignInCommand>): Promise<SignInOutcome> {
    return this.signInUseCase.execute({
      ...input,
      clientIp: requestContext()?.clientIp,
    });
  }

  /** The second step. Resolves the client IP exactly as `signIn` does — both spend one window. */
  completeFactor(
    input: SessionServiceInput<CompleteFactorChallengeCommand>,
  ): Promise<IssuedSession> {
    return this.completeFactorUseCase.execute({
      ...input,
      clientIp: requestContext()?.clientIp,
    });
  }

  refresh(input: SessionServiceInput<RefreshSessionCommand>): Promise<IssuedSession> {
    return this.refreshSessionUseCase.execute(input);
  }

  signOut(input: SessionServiceInput<SignOutCommand>): Promise<void> {
    return this.signOutUseCase.execute(input);
  }
}
