import { Injectable } from '@nestjs/common';
import { requestContext } from '@api/infrastructure/persistence/request-context';
import { AuthenticationRequiredError } from '@api/modules/identity/membership/errors/membership.errors';
import type { IssuedSession } from '@api/modules/identity/session/models/session.model';
import type { AccountSetupState } from '../models/account-setup.model';
import { ReadAccountSetup } from '../use-cases/read-account-setup.use-case';
import {
  SaveSetupProfile,
  type SaveSetupProfileCommand,
} from '../use-cases/save-setup-profile.use-case';
import {
  SetFirstPassword,
  type SetFirstPasswordCommand,
} from '../use-cases/set-first-password.use-case';
import {
  SetFirstPasswordByGrant,
  type SetFirstPasswordByGrantCommand,
} from '../use-cases/set-first-password-by-grant.use-case';

/**
 * The seam between the two setup controllers and their use cases (house rule: controllers call
 * services, services call use cases), task 155.
 *
 * It resolves the two ambient values `PasswordService` resolves, for its reasons: the acting account,
 * and the session this request acts on — whose creation instant is the first password's proof. Both
 * come from the request context `AuthGuard` wrote, never from the body.
 */
@Injectable()
export class AccountSetupService {
  constructor(
    private readonly readAccountSetup: ReadAccountSetup,
    private readonly setFirstPasswordUseCase: SetFirstPassword,
    private readonly setFirstPasswordByGrantUseCase: SetFirstPasswordByGrant,
    private readonly saveSetupProfile: SaveSetupProfile,
  ) {}

  read(): Promise<AccountSetupState> {
    return this.readAccountSetup.execute({ accountId: this.actor().accountId });
  }

  setFirstPassword(
    input: Omit<SetFirstPasswordCommand, 'accountId' | 'sessionId'>,
  ): Promise<AccountSetupState> {
    return this.setFirstPasswordUseCase.execute({ password: input.password, ...this.actor() });
  }

  /** The link path is public: the grant is the whole of the caller's standing, so nothing is ambient. */
  setFirstPasswordByGrant(input: SetFirstPasswordByGrantCommand): Promise<IssuedSession> {
    return this.setFirstPasswordByGrantUseCase.execute({
      grant: input.grant,
      password: input.password,
      remember: input.remember,
    });
  }

  saveProfile(input: Omit<SaveSetupProfileCommand, 'accountId'>): Promise<AccountSetupState> {
    return this.saveSetupProfile.execute({
      givenName: input.givenName,
      familyName: input.familyName,
      locale: input.locale,
      accountId: this.actor().accountId,
    });
  }

  /**
   * `AuthGuard` closes the surface by default, so reaching here without either is a wiring defect
   * rather than a request — refused rather than asserted, so a guard regression is a 401 and not a
   * `TypeError` three layers down.
   */
  private actor(): { readonly accountId: string; readonly sessionId: string } {
    const context = requestContext();
    if (context?.actorId === undefined || context.sessionId === undefined) {
      throw new AuthenticationRequiredError();
    }
    return { accountId: context.actorId, sessionId: context.sessionId };
  }
}
