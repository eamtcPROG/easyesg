import { Injectable } from '@nestjs/common';
import { requestContext } from '@api/infrastructure/persistence/request-context';
import {
  SubmitSupportRequest,
  type SubmitSupportRequestCommand,
} from '../use-cases/submit-support-request.use-case';

/**
 * UC-182 from HTTP (task 77). It resolves the two fields the request supplies and the body may not: **who is sending**
 * — the account `AuthGuard` resolved from a bearer, or nobody where none came (`@AdmitsVisitor`) — and **for which
 * organization**, the one the session acts for. Taken from the body, either would let anyone send in another person's
 * or another organization's name.
 */
@Injectable()
export class SupportRequestService {
  constructor(private readonly submitRequest: SubmitSupportRequest) {}

  submit(input: Omit<SubmitSupportRequestCommand, 'accountId' | 'organizationId'>): Promise<{ readonly reference: string }> {
    const context = requestContext();
    return this.submitRequest.execute({
      ...input,
      accountId: context?.actorId ?? null,
      organizationId: context?.organizationId ?? null,
    });
  }
}
