import { Injectable } from '@nestjs/common';
import { requestContext } from '@api/infrastructure/persistence/request-context';
import {
  AcceptAdminInvitation,
  type AcceptAdminInvitationCommand,
  type AcceptedAdminInvitation,
} from '../use-cases/accept-admin-invitation.use-case';
import {
  PreviewAdminInvitation,
  type AdminInvitationPreview,
  type PresentAdminInvitationCommand,
} from '../use-cases/preview-admin-invitation.use-case';
import {
  StageAdminEnrolment,
  type AdminEnrolmentOffer,
} from '../use-cases/stage-admin-enrolment.use-case';

/**
 * A-20's three steps (task 67.4). **It forwards the client address to all three**, because they spend
 * one window keyed on it — `TotpService` once dropped it on some routes and not others, which split one
 * budget into two keys with nothing failing (`apps/api/CLAUDE.md`).
 */
@Injectable()
export class AdminInvitationAcceptanceService {
  constructor(
    private readonly previewUseCase: PreviewAdminInvitation,
    private readonly stageUseCase: StageAdminEnrolment,
    private readonly acceptUseCase: AcceptAdminInvitation,
  ) {}

  preview(input: Omit<PresentAdminInvitationCommand, 'clientIp'>): Promise<AdminInvitationPreview> {
    return this.previewUseCase.execute({ ...input, clientIp: requestContext()?.clientIp });
  }

  stage(input: Omit<PresentAdminInvitationCommand, 'clientIp'>): Promise<AdminEnrolmentOffer> {
    return this.stageUseCase.execute({ ...input, clientIp: requestContext()?.clientIp });
  }

  accept(input: Omit<AcceptAdminInvitationCommand, 'clientIp'>): Promise<AcceptedAdminInvitation> {
    return this.acceptUseCase.execute({ ...input, clientIp: requestContext()?.clientIp });
  }
}
