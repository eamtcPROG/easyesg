import { Injectable } from '@nestjs/common';
import type { QueryRunner } from 'typeorm';
import { displayName } from '@api/modules/identity/account/domain/display-name';
import {
  MEMBERSHIP_STATUS,
  type MembershipRole,
} from '@api/modules/identity/membership/models/membership.model';
import type {
  MemberPhoneRead,
  OrganizationMembersRead,
  OrganizationMembersStore,
} from '@api/modules/platform/admin/interfaces/organization-members-store.interface';
import type { OrganizationMember } from '@api/modules/platform/admin/models/organization-member.model';
import { ACQUISITION_PURPOSE } from '@api/modules/platform/support-access/models/support-access-log.model';
import { AdminReadOnly } from '../admin-readonly';
import { collated } from '../collation';

interface MemberDbRow {
  account_id: string;
  given_name: string | null;
  family_name: string | null;
  email: string;
  role: MembershipRole;
  has_phone: boolean;
}

/**
 * A-02's record's people (task 167; §12.5.6's task-167 row), read through `esg_admin_ro` — which holds `SELECT` on
 * `identity.account` and `identity.membership` already — **each read one acquisition, logged before it runs**
 * (`admin-readonly.ts`), naming the organization read, under the register's purpose: the record is the register's.
 *
 * **The list reads whether a phone was given, never the number** (`phone IS NOT NULL`), so opening a record discloses
 * no one's phone; `phone` reads one number, and the route that asks for it writes the audit row. **The name is derived
 * in TypeScript by `displayName`**, the one helper every other surface derives it with, rather than a third copy of
 * the SQL form `access-store.repository.ts` documents itself against; the ordering is by the same parts, collated.
 */
const MEMBERS = `
  SELECT a.id AS account_id, a.given_name, a.family_name, a.email, m.role, (a.phone IS NOT NULL) AS has_phone
    FROM identity.membership m
    JOIN identity.account a ON a.id = m.account_id
   WHERE m.organization_id = $1 AND m.status = '${MEMBERSHIP_STATUS.ACTIVE}'
   ORDER BY ${collated("COALESCE(NULLIF(btrim(concat_ws(' ', a.given_name, a.family_name)), ''), a.email)")}, a.id`;

@Injectable()
export class OrganizationMembersStoreRepository implements OrganizationMembersStore {
  constructor(private readonly adminReadOnly: AdminReadOnly) {}

  members(read: OrganizationMembersRead): Promise<readonly OrganizationMember[] | null> {
    return this.acquire(read, async (runner) => {
      const found = (await runner.query(`SELECT 1 FROM core.organization WHERE id = $1`, [
        read.organizationId,
      ])) as unknown[];
      if (found.length === 0) return null;
      const rows = (await runner.query(MEMBERS, [read.organizationId])) as MemberDbRow[];
      return rows.map(
        (row): OrganizationMember => ({
          accountId: row.account_id,
          displayName: displayName({ givenName: row.given_name, familyName: row.family_name }, row.email),
          email: row.email,
          role: row.role,
          hasPhone: row.has_phone,
        }),
      );
    });
  }

  phone(read: MemberPhoneRead): Promise<string | null> {
    return this.acquire(read, async (runner) => {
      const rows = (await runner.query(
        `SELECT a.phone
           FROM identity.membership m
           JOIN identity.account a ON a.id = m.account_id
          WHERE m.organization_id = $1 AND m.account_id = $2 AND m.status = '${MEMBERSHIP_STATUS.ACTIVE}'`,
        [read.organizationId, read.accountId],
      )) as { phone: string | null }[];
      return rows[0]?.phone ?? null;
    });
  }

  private acquire<T>(read: OrganizationMembersRead, work: (runner: QueryRunner) => Promise<T>): Promise<T> {
    return this.adminReadOnly.acquire(
      {
        requesterId: read.requesterId,
        purpose: ACQUISITION_PURPOSE.ORGANIZATION_REGISTER,
        organizationId: read.organizationId,
      },
      work,
    );
  }
}
