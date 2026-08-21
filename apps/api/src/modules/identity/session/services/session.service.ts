import { Injectable } from '@nestjs/common';
import { requestContext } from '@api/infrastructure/persistence/request-context';
import type { IssuedSession } from '../models/session.model';
import { RefreshSession } from '../use-cases/refresh-session.use-case';
import { SignIn } from '../use-cases/sign-in.use-case';
import { SignOut } from '../use-cases/sign-out.use-case';

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
    private readonly refreshSessionUseCase: RefreshSession,
    private readonly signOutUseCase: SignOut,
  ) {}

  signIn(email: string, password: string): Promise<IssuedSession> {
    return this.signInUseCase.execute({
      email,
      password,
      clientIp: requestContext()?.clientIp,
    });
  }

  refresh(refreshToken: string): Promise<IssuedSession> {
    return this.refreshSessionUseCase.execute({ refreshToken });
  }

  signOut(refreshToken: string): Promise<void> {
    return this.signOutUseCase.execute({ refreshToken });
  }
}
