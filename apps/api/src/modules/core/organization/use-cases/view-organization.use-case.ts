import type { Organization } from '../models/organization.model';
import type { OrganizationStore } from '../interfaces/organization-store.interface';
import { OrganizationNotFoundError } from '../errors/organization.errors';

/**
 * UC-50's read half (FR-15) — S-15's Record screen, and the source of the values that propagate
 * into every report the organization produces.
 *
 * **It takes no command**, which is the tenancy model rather than a missing parameter: the only
 * organization this can reach is the one bound to the request, and an id would be the second source
 * of tenancy AD-2 and UX-2 forbid.
 */
export class ViewOrganization {
  constructor(private readonly store: OrganizationStore) {}

  async execute(): Promise<Organization> {
    const organization = await this.store.findBoundOrganization();
    if (!organization) throw new OrganizationNotFoundError();
    return organization;
  }
}
