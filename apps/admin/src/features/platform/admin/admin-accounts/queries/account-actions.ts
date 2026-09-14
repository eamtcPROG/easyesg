import type {
  AdminInvitation,
  ApiOutcome,
  InviteAdministratorRequest,
} from '@easyesg/contracts';
import { api } from '~/realm/api/api-client';
import { ACCOUNT_CONTROL, type AccountControl } from '../tools/account-controls';

/**
 * A-08's writes (task 67.4) — one function per wire shape, through the realm's one client. The api
 * records each in the system audit log itself (`AuditInterceptor`); nothing here names an actor, which
 * is the point: the operator is whoever the session says.
 */
const accounts = (id: string) => `/admin/accounts/${encodeURIComponent(id)}`;
const invitations = (id: string) => `/admin/invitations/${encodeURIComponent(id)}`;

export function runAccountControl(input: {
  readonly control: AccountControl;
  readonly rowId: string;
}): Promise<ApiOutcome<undefined>> {
  switch (input.control) {
    case ACCOUNT_CONTROL.RELEASE_LOCKOUT:
      return api.post(`${accounts(input.rowId)}/lockout-release`, {});
    case ACCOUNT_CONTROL.REACTIVATE:
      return api.post(`${accounts(input.rowId)}/reactivation`, {});
    case ACCOUNT_CONTROL.SUSPEND:
      return api.post(`${accounts(input.rowId)}/suspension`, {});
    case ACCOUNT_CONTROL.REMOVE:
      return api.post(`${accounts(input.rowId)}/removal`, {});
    case ACCOUNT_CONTROL.RESEND:
      return api.post(`${invitations(input.rowId)}/email`, {});
    case ACCOUNT_CONTROL.REVOKE:
      return api.delete(invitations(input.rowId));
  }
}

export function inviteAdministrator(
  command: InviteAdministratorRequest,
): Promise<ApiOutcome<AdminInvitation>> {
  return api.post<InviteAdministratorRequest, AdminInvitation>('/admin/invitations', command);
}
