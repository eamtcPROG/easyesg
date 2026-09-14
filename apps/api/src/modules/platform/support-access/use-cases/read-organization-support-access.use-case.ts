import type { Clock } from '@api/contracts/clock.port';
import {
  MEMBERSHIP_ROLE,
  type MembershipRole,
} from '@api/modules/identity/membership/models/membership.model';
import { SUPPORT_ACCESS_HORIZON_MS, supportAccessRequestOf } from '../domain/support-access-request';
import type { OrganizationSupportAccessStore } from '../interfaces/organization-support-access-store.interface';
import {
  SUPPORT_ACCESS_STATE,
  type OrganizationSupportAccess,
} from '../models/support-access-request.model';

/**
 * What the organization is shown about support access (task 67.9; UX-124, amended 14 Sep 2026).
 *
 * **Running access is every member's to see** — whoever is in the application while EasyESG reads the
 * organization's reports is told so. **A request awaiting an answer is an Organization Administrator's**,
 * because they are the one who answers it; another member would be shown a question they cannot act on.
 */
export class ReadOrganizationSupportAccess {
  constructor(
    private readonly store: OrganizationSupportAccessStore,
    private readonly now: Clock,
  ) {}

  async execute(query: { readonly role: MembershipRole }): Promise<OrganizationSupportAccess> {
    const now = this.now();
    const history = await this.store.history({ since: new Date(now.getTime() - SUPPORT_ACCESS_HORIZON_MS) });
    const requests = history.requests.map((request) =>
      supportAccessRequestOf({ request, decisions: history.decisions, now }),
    );

    return {
      awaiting:
        query.role === MEMBERSHIP_ROLE.ORGANIZATION_ADMINISTRATOR
          ? requests.filter((request) => request.state === SUPPORT_ACCESS_STATE.AWAITING)
          : [],
      active: requests.find((request) => request.state === SUPPORT_ACCESS_STATE.ACTIVE) ?? null,
    };
  }
}
