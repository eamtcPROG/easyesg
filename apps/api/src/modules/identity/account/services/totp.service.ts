import { Injectable } from '@nestjs/common';
import { requestContext } from '@api/infrastructure/persistence/request-context';
import { AuthenticationRequiredError } from '@api/modules/identity/membership/errors/membership.errors';
import type { TotpState } from '../models/totp.model';
import {
  ManageTotp,
  type TotpEnrolmentOffer,
} from '../use-cases/manage-totp.use-case';

/**
 * The Nest-aware seam between `TotpController` and `ManageTotp` (house rule: controllers call
 * services, services call use cases).
 *
 * **Its whole job is resolving the acting account, and that is exactly why it is not a
 * pass-through.** `accountId` is read here from the request context — where `AuthGuard` wrote it
 * after resolving the bearer token against the session record — and never from the request body or
 * a path segment. That resolution has to happen at this layer precisely so it cannot happen at the
 * layer above: an account id arriving from the wire would turn "enrol my second factor" into
 * "enrol theirs", and every route below would answer it. `MembershipService.listOwn` makes the same
 * move for the same reason.
 *
 * The commands are otherwise taken whole, so a field added to one arrives here untouched.
 */
@Injectable()
export class TotpService {
  constructor(private readonly manageTotp: ManageTotp) {}

  /**
   * The signed-in account, or a refusal.
   *
   * `AuthGuard` closes the surface by default, so reaching a route without an actor is a wiring
   * defect rather than a request. It refuses rather than asserting, because the failure a guard
   * regression produces should be a 401 and not a `TypeError` three layers down.
   */
  private actorId(): string {
    const accountId = requestContext()?.actorId;
    if (accountId === undefined) throw new AuthenticationRequiredError();
    return accountId;
  }

  begin(input: { readonly password?: string }): Promise<TotpEnrolmentOffer> {
    return this.manageTotp.begin({ ...input, accountId: this.actorId() });
  }

  confirm(input: { readonly code: string }): Promise<readonly string[]> {
    return this.manageTotp.confirm({ ...input, accountId: this.actorId() });
  }

  disable(input: { readonly password?: string }): Promise<void> {
    return this.manageTotp.disable({ ...input, accountId: this.actorId() });
  }

  reissueRecoveryCodes(input: { readonly password?: string }): Promise<readonly string[]> {
    return this.manageTotp.reissueRecoveryCodes({ ...input, accountId: this.actorId() });
  }

  state(): Promise<TotpState> {
    return this.manageTotp.state(this.actorId());
  }
}
