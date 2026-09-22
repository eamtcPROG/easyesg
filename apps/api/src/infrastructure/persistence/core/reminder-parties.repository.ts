import { Injectable } from '@nestjs/common';
import type { ReminderParties } from '@api/modules/core/disclosure/interfaces/reminder-parties.interface';
import type { MembershipStatus } from '@api/modules/identity/membership/models/membership.model';
import { TenantRepository } from '../tenant-repository';

/**
 * `REMINDER_PARTIES` (task 50.3) — the member a reminder goes to and the account sending it, on the request's
 * transaction.
 *
 * **The membership is read under RLS**, so another organization's membership id finds nothing, which is the same
 * answer as no such membership. **The sender's account carries no RLS** — `identity.account` is read by id, as
 * `OrganizationStoreRepository`'s trail reads it — and the id is the request's own actor, never a caller's field.
 */
@Injectable()
export class ReminderPartiesRepository extends TenantRepository<never> implements ReminderParties {
  protected readonly entity = 'identity.membership' as never;

  async recipient(input: { readonly membershipId: string }) {
    const [row] = await this.manager.query<{ account_id: string; status: MembershipStatus }[]>(
      `SELECT account_id, status FROM identity.membership WHERE id = $1`,
      [input.membershipId],
    );
    return row === undefined ? null : { accountId: row.account_id, status: row.status };
  }

  async sender(input: { readonly accountId: string }) {
    const [row] = await this.manager.query<{ given_name: string | null; family_name: string | null; email: string }[]>(
      `SELECT given_name, family_name, email FROM identity.account WHERE id = $1`,
      [input.accountId],
    );
    return row === undefined ? null : { givenName: row.given_name, familyName: row.family_name, email: row.email };
  }
}
