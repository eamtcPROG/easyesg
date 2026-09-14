import { queryOptions } from '@tanstack/react-query';
import type {
  AcceptAdminInvitationRequest,
  AcceptedAdminInvitation,
  AdminEnrolment,
  AdminInvitationPreview,
  AdminInvitationTokenRequest,
  ApiOutcome,
} from '@easyesg/contracts';
import { api } from '../api/api-client';

/**
 * A-20's three calls (task 67.4) — the bearer of an administrator invitation's link, who holds no
 * session. **The token travels in a body every time**, never a query string: it sets a credential.
 *
 * **The preview is a query and not a mutation**: it reads, a live link spends nothing, and a reload
 * should read again. It does not retry — a link that did not resolve is an answer, and a retry would
 * spend the bearer window on the same answer twice.
 */
const INVITATION_PATH = '/auth/admin/invitation';

export const adminInvitationPreviewQuery = (token: string) =>
  queryOptions({
    queryKey: ['admin-invitation', 'preview', token] as const,
    queryFn: () =>
      api.post<AdminInvitationTokenRequest, AdminInvitationPreview>(`${INVITATION_PATH}/preview`, { token }),
    retry: false,
    refetchOnWindowFocus: false,
  });

export function stageAdminEnrolment(token: string): Promise<ApiOutcome<AdminEnrolment>> {
  return api.post<AdminInvitationTokenRequest, AdminEnrolment>(`${INVITATION_PATH}/enrolment`, { token });
}

export function acceptAdminInvitation(
  command: AcceptAdminInvitationRequest,
): Promise<ApiOutcome<AcceptedAdminInvitation>> {
  return api.post<AcceptAdminInvitationRequest, AcceptedAdminInvitation>(
    `${INVITATION_PATH}/acceptance`,
    command,
  );
}
