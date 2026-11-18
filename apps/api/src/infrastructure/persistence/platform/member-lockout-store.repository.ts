import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { MEMBERSHIP_STATUS } from '@api/modules/identity/membership/models/membership.model';
import {
  MEMBER_LOCKOUT_RELEASE,
  type MemberLockoutRelease,
  type MemberLockoutReleaseOutcome,
  type MemberLockoutStore,
} from '@api/modules/platform/admin/interfaces/member-lockout-store.interface';
import { ACQUISITION_PURPOSE } from '@api/modules/platform/support-access/models/support-access-log.model';
import { AdminReadOnly } from '../admin-readonly';
import { CORE_DATA_SOURCE } from '../data-source';
import { returnedRows } from '../returned-rows';

/**
 * A-02's release of a locked tenant account (task 67.12; FR-209; §12.5.6's task-67.12 row).
 *
 * **Membership is read through `esg_admin_ro`**, logged before it reads under the register's purpose, because a
 * membership of another organization is invisible to `esg_app` with none bound. **The release is `esg_app`'s write
 * to `identity.credential`** — the table the reset link releases — one statement clearing `locked_at` and
 * `failed_attempts` together, matching only a row whose lock is set, so an unlocked account changes nothing and is
 * answered as such. A membership ended between the two statements leaves a lock released for someone who was a member
 * a moment before; the record the operator acted on said so, and nothing about the account's report content moves.
 */
@Injectable()
export class MemberLockoutStoreRepository implements MemberLockoutStore {
  constructor(
    private readonly adminReadOnly: AdminReadOnly,
    @InjectDataSource(CORE_DATA_SOURCE) private readonly dataSource: DataSource,
  ) {}

  async release(release: MemberLockoutRelease): Promise<MemberLockoutReleaseOutcome> {
    const member = await this.adminReadOnly.acquire(
      {
        requesterId: release.requesterId,
        purpose: ACQUISITION_PURPOSE.ORGANIZATION_REGISTER,
        organizationId: release.organizationId,
      },
      async (runner) =>
        ((await runner.query(
          `SELECT 1 FROM identity.membership
            WHERE organization_id = $1 AND account_id = $2 AND status = '${MEMBERSHIP_STATUS.ACTIVE}'`,
          [release.organizationId, release.accountId],
        )) as unknown[]).length > 0,
    );
    if (!member) return MEMBER_LOCKOUT_RELEASE.NOT_A_MEMBER;

    const released = returnedRows<{ account_id: string }>(
      await this.dataSource.query(
        `UPDATE identity.credential
            SET locked_at = NULL, failed_attempts = 0, updated_at = $2
          WHERE account_id = $1 AND locked_at IS NOT NULL
          RETURNING account_id`,
        [release.accountId, release.at],
      ),
    );
    return released.length > 0 ? MEMBER_LOCKOUT_RELEASE.RELEASED : MEMBER_LOCKOUT_RELEASE.NOT_LOCKED;
  }
}
