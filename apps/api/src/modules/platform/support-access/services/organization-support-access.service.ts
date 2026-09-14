import { Injectable } from '@nestjs/common';
import { requestContext } from '@api/infrastructure/persistence/request-context';
import { MembershipRequiredError } from '@api/modules/identity/membership/errors/membership.errors';
import type { MembershipRole } from '@api/modules/identity/membership/models/membership.model';
import { SUPPORT_ACCESS_ENTRY_KIND } from '../models/support-access-log.model';
import type { OrganizationSupportAccess } from '../models/support-access-request.model';
import { AnswerSupportAccessRequest } from '../use-cases/answer-support-access-request.use-case';
import { EndSupportAccessAsOrganization } from '../use-cases/end-support-access-as-organization.use-case';
import { ReadOrganizationSupportAccess } from '../use-cases/read-organization-support-access.use-case';

/**
 * The organization's half of support access (task 67.9; UC-85, UX-124) — the banner's read, and an Organization
 * Administrator's grant, decline or end. It resolves the member from the request, as every tenant service does:
 * the role for what the banner shows, the account for who answered.
 */
@Injectable()
export class OrganizationSupportAccessService {
  constructor(
    private readonly readUseCase: ReadOrganizationSupportAccess,
    private readonly answerUseCase: AnswerSupportAccessRequest,
    private readonly endUseCase: EndSupportAccessAsOrganization,
  ) {}

  current(): Promise<OrganizationSupportAccess> {
    return this.readUseCase.execute({ role: requestMember().role });
  }

  grant(input: { readonly requestId: string }): Promise<void> {
    return this.answerUseCase.execute({
      requestId: input.requestId,
      actorId: requestMember().actorId,
      answer: SUPPORT_ACCESS_ENTRY_KIND.GRANT,
    });
  }

  decline(input: { readonly requestId: string }): Promise<void> {
    return this.answerUseCase.execute({
      requestId: input.requestId,
      actorId: requestMember().actorId,
      answer: SUPPORT_ACCESS_ENTRY_KIND.DECLINE,
    });
  }

  end(input: { readonly requestId: string }): Promise<void> {
    return this.endUseCase.execute({ requestId: input.requestId, actorId: requestMember().actorId });
  }
}

/**
 * The member this request acts as. `@RequiresRole` has already refused a request without one; this throws
 * rather than trusting that, so a route that lost its decorator refuses instead of answering for nobody.
 */
const requestMember = (): { readonly actorId: string; readonly role: MembershipRole } => {
  const ctx = requestContext();
  if (!ctx?.actorId || !ctx.role) throw new MembershipRequiredError();
  return { actorId: ctx.actorId, role: ctx.role };
};
