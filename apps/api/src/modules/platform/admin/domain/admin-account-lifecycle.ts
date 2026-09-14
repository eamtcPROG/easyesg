import { ADMIN_ACCOUNT_CHANGE, type AdminAccountChange } from '../models/admin-account-change.model';
import type { AdminAccountRecord } from '../models/admin-roster.model';
import {
  ADMIN_ACCOUNT_STATUS,
  ADMIN_ROLE,
  ADMIN_SESSION_REVOKED_REASON,
  type AdminAccountStatus,
  type AdminSessionRevokedReason,
} from '../models/admin-session.model';

/**
 * What A-08 may do to an account's lifecycle, and when (task 67.4; FR-80; §12.5.6's task-67.4 row).
 *
 * **Suspension is reversible and removal is final** (project owner, 13 Sep 2026). A removed account
 * stays for attribution and accepts no further change — inviting its address again creates a new
 * account. The table below is the whole of which change applies from which status, so a fourth
 * status added later is a type error here rather than a branch someone forgets.
 */
const APPLIES_FROM: Record<AdminAccountChange, readonly AdminAccountStatus[]> = {
  [ADMIN_ACCOUNT_CHANGE.SUSPEND]: [ADMIN_ACCOUNT_STATUS.ACTIVE],
  [ADMIN_ACCOUNT_CHANGE.REACTIVATE]: [ADMIN_ACCOUNT_STATUS.SUSPENDED],
  [ADMIN_ACCOUNT_CHANGE.REMOVE]: [ADMIN_ACCOUNT_STATUS.ACTIVE, ADMIN_ACCOUNT_STATUS.SUSPENDED],
};

const RESULTING_STATUS: Record<AdminAccountChange, AdminAccountStatus> = {
  [ADMIN_ACCOUNT_CHANGE.SUSPEND]: ADMIN_ACCOUNT_STATUS.SUSPENDED,
  [ADMIN_ACCOUNT_CHANGE.REACTIVATE]: ADMIN_ACCOUNT_STATUS.ACTIVE,
  [ADMIN_ACCOUNT_CHANGE.REMOVE]: ADMIN_ACCOUNT_STATUS.REMOVED,
};

/**
 * **Suspension and removal end the account's sessions**; reactivation revives none. Task 145's read
 * already refuses a session whose account is not active, so without the revocation a reactivation
 * would hand back every session the suspension ended.
 */
const REVOCATION: Record<AdminAccountChange, AdminSessionRevokedReason | null> = {
  [ADMIN_ACCOUNT_CHANGE.SUSPEND]: ADMIN_SESSION_REVOKED_REASON.ACCOUNT_SUSPENDED,
  [ADMIN_ACCOUNT_CHANGE.REACTIVATE]: null,
  [ADMIN_ACCOUNT_CHANGE.REMOVE]: ADMIN_SESSION_REVOKED_REASON.ACCOUNT_REMOVED,
};

export const adminAccountChangeApplies = (input: {
  readonly change: AdminAccountChange;
  readonly status: AdminAccountStatus;
}): boolean => APPLIES_FROM[input.change].includes(input.status);

/** The statuses a change may start from — the store's conditional write reads the same table. */
export const statusesAdminAccountChangeAppliesFrom = (
  change: AdminAccountChange,
): readonly AdminAccountStatus[] => APPLIES_FROM[change];

export const statusAfterAdminAccountChange = (change: AdminAccountChange): AdminAccountStatus =>
  RESULTING_STATUS[change];

export const sessionRevocationFor = (change: AdminAccountChange): AdminSessionRevokedReason | null =>
  REVOCATION[change];

/**
 * FR-60's lockout rule, applied to the realm: **the last active Platform Administrator cannot be
 * suspended or removed**, because nobody would be left to reactivate, invite or release anyone — and
 * the provisioning CLI is a bootstrap, not a recovery path the product may rely on.
 *
 * Counted by the caller inside the transaction that writes, under a lock, so two administrators
 * suspending each other at once cannot both pass. A suspended Platform Administrator is not counted
 * and changes nothing by leaving, which is why the account's own status is part of the test.
 */
export const wouldLeaveNoPlatformAdministrator = (input: {
  readonly account: Pick<AdminAccountRecord, 'role' | 'status'>;
  readonly change: AdminAccountChange;
  readonly activePlatformAdministrators: number;
}): boolean =>
  input.change !== ADMIN_ACCOUNT_CHANGE.REACTIVATE &&
  input.account.role === ADMIN_ROLE.PLATFORM_ADMINISTRATOR &&
  input.account.status === ADMIN_ACCOUNT_STATUS.ACTIVE &&
  input.activePlatformAdministrators <= 1;
