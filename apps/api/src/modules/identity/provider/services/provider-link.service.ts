import { Injectable } from '@nestjs/common';
import { requestContext } from '@api/infrastructure/persistence/request-context';
import { AuthenticationRequiredError } from '@api/modules/identity/membership/errors/membership.errors';
import type { ProviderIdentity } from '../models/provider-identity.model';
import {
  ManageProviderLinks,
  type LinkProviderCommand,
  type UnlinkProviderCommand,
} from '../use-cases/manage-provider-links.use-case';

/**
 * The seam between `ProviderLinkController` and `ManageProviderLinks` (house rule: controllers call
 * services, services call use cases).
 *
 * Its job is the ambient half — the acting account from the request context where `AuthGuard` wrote
 * it, and the client IP for §12.5.6's window. Neither may come from the wire: an account id in a
 * body would turn "link my Google account" into "link it to theirs", on a route whose whole effect
 * is granting a way in.
 */
@Injectable()
export class ProviderLinkService {
  constructor(private readonly manageLinks: ManageProviderLinks) {}

  private actorId(): string {
    const accountId = requestContext()?.actorId;
    if (accountId === undefined) throw new AuthenticationRequiredError();
    return accountId;
  }

  link(input: Omit<LinkProviderCommand, 'accountId' | 'clientIp'>): Promise<void> {
    return this.manageLinks.link({
      ...input,
      accountId: this.actorId(),
      clientIp: requestContext()?.clientIp,
    });
  }

  unlink(input: Omit<UnlinkProviderCommand, 'accountId' | 'clientIp'>): Promise<void> {
    return this.manageLinks.unlink({
      ...input,
      accountId: this.actorId(),
      clientIp: requestContext()?.clientIp,
    });
  }

  linked(): Promise<ProviderIdentity[]> {
    return this.manageLinks.linked(this.actorId());
  }
}
