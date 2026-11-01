import { Injectable } from '@nestjs/common';
import { requestContext } from '@api/infrastructure/persistence/request-context';
import { AuthenticationRequiredError } from '@api/modules/identity/membership/errors/membership.errors';
import type { OwedLegalDocument } from '../models/legal-acceptance.model';
import {
  AcceptLegalDocuments,
  type AcceptLegalDocumentsCommand,
} from '../use-cases/accept-legal-documents.use-case';
import { ReadLegalAcceptance } from '../use-cases/read-legal-acceptance.use-case';

/**
 * The seam between `LegalAcceptanceController` and its two use cases (task 195), and where the one ambient value is
 * resolved: **the account, from the session** — never from the wire, so nobody accepts on another person's behalf.
 */
@Injectable()
export class LegalAcceptanceService {
  constructor(
    private readonly readAcceptance: ReadLegalAcceptance,
    private readonly acceptDocuments: AcceptLegalDocuments,
  ) {}

  owed(): Promise<OwedLegalDocument[]> {
    return this.readAcceptance.execute({ accountId: sessionAccount() });
  }

  accept(input: Omit<AcceptLegalDocumentsCommand, 'accountId'>): Promise<void> {
    return this.acceptDocuments.execute({ ...input, accountId: sessionAccount() });
  }
}

/** `PasswordService`'s reading: reaching here without an actor is a guard regression, answered 401 rather than a throw. */
const sessionAccount = (): string => {
  const actorId = requestContext()?.actorId;
  if (actorId === undefined) throw new AuthenticationRequiredError();
  return actorId;
};
