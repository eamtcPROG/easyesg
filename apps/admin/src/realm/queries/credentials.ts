import { queryOptions } from '@tanstack/react-query';
import type {
  AdminCredentials,
  AdminEnrolment,
  AdminPasswordChanged,
  AdminReauthenticationRequest,
  AdminRecoveryCodes,
  ApiOutcome,
  ChangeAdminPasswordRequest,
  ConfirmAdminReenrolmentRequest,
} from '@easyesg/contracts';
import { api } from '../api/api-client';

/**
 * A-19's wire (task 151) — `/admin/credentials`, which task 144 built for both privilege levels. The
 * read is the recovery-code standing, the one thing on the screen that differs between operators; the
 * four writes are UC-212's steps, and every one carries the current password.
 *
 * **In `realm/`, not under `features/`**, for A-01's reason: the screen serves a Platform
 * Administrator and a Billing Operator alike and belongs to neither context.
 *
 * The read resolves to an outcome rather than throwing, A-02's reason: a 401 is a state the screen
 * draws, and a retry would ask again for an answer already final. **No poll** (UX-116): issuing a set
 * invalidates the key, and nothing else on the screen changes what it reads.
 */
export const ADMIN_CREDENTIALS_QUERY_KEY = ['admin', 'credentials'] as const;

const CREDENTIALS_PATH = '/admin/credentials';

export const adminCredentialsQuery = () =>
  queryOptions({
    queryKey: ADMIN_CREDENTIALS_QUERY_KEY,
    queryFn: () => api.get<AdminCredentials>(CREDENTIALS_PATH),
  });

/** UC-212 step one — a new password, optionally ending the operator's other sessions. */
export function changeAdminPassword(
  command: ChangeAdminPasswordRequest,
): Promise<ApiOutcome<AdminPasswordChanged>> {
  return api.post<ChangeAdminPasswordRequest, AdminPasswordChanged>(
    `${CREDENTIALS_PATH}/password`,
    command,
  );
}

/** UC-212 step two, first half — a secret staged beside the factor in force, answered this once. */
export function beginAdminReenrolment(
  command: AdminReauthenticationRequest,
): Promise<ApiOutcome<AdminEnrolment>> {
  return api.post<AdminReauthenticationRequest, AdminEnrolment>(
    `${CREDENTIALS_PATH}/totp/enrolment`,
    command,
  );
}

/** UC-212 step two, second half — the staged secret replaces the factor in force. */
export function confirmAdminReenrolment(
  command: ConfirmAdminReenrolmentRequest,
): Promise<ApiOutcome<undefined>> {
  return api.post<ConfirmAdminReenrolmentRequest, undefined>(
    `${CREDENTIALS_PATH}/totp/confirmation`,
    command,
  );
}

/** UC-212 step three — ten single-use codes, shown once, replacing any set before them. */
export function issueAdminRecoveryCodes(
  command: AdminReauthenticationRequest,
): Promise<ApiOutcome<AdminRecoveryCodes>> {
  return api.post<AdminReauthenticationRequest, AdminRecoveryCodes>(
    `${CREDENTIALS_PATH}/recovery-codes`,
    command,
  );
}
