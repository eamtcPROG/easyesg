import { Injectable } from '@nestjs/common';
import type { AdminInvitation } from '../models/admin-invitation.model';
import {
  InviteAdministrator,
  type InviteAdministratorCommand,
} from '../use-cases/invite-administrator.use-case';
import {
  ResendAdminInvitation,
  type ResendAdminInvitationCommand,
} from '../use-cases/resend-admin-invitation.use-case';
import {
  RevokeAdminInvitation,
  type RevokeAdminInvitationCommand,
} from '../use-cases/revoke-admin-invitation.use-case';
import { requestOperatorId } from './request-operator';

/**
 * A-08's invitations (task 67.4; UC-87) — issue, resend, revoke. The inviter is the request's operator,
 * which is why the command's `invitedBy` is omitted from what the controller may pass.
 */
@Injectable()
export class AdminInvitationsService {
  constructor(
    private readonly inviteUseCase: InviteAdministrator,
    private readonly resendUseCase: ResendAdminInvitation,
    private readonly revokeUseCase: RevokeAdminInvitation,
  ) {}

  invite(input: Omit<InviteAdministratorCommand, 'invitedBy'>): Promise<AdminInvitation> {
    return this.inviteUseCase.execute({ ...input, invitedBy: requestOperatorId() });
  }

  resend(input: ResendAdminInvitationCommand): Promise<void> {
    return this.resendUseCase.execute(input);
  }

  revoke(input: RevokeAdminInvitationCommand): Promise<void> {
    return this.revokeUseCase.execute(input);
  }
}
