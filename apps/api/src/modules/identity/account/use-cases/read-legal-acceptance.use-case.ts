import { LEGAL_VERSIONS_IN_FORCE } from '@easyesg/i18n';
import { documentsOwed } from '../domain/legal-acceptance';
import type { LegalAcceptanceStore } from '../interfaces/legal-acceptance-store.interface';
import type { OwedLegalDocument } from '../models/legal-acceptance.model';

/**
 * What S-43 asks the signed-in account to accept (task 195; §12.5.6's task-195 row (2)): each document whose latest
 * acceptance is absent or names another version, at the version in force — the same rule `AuthGuard` refuses by, over
 * the same read, so the screen and the gate cannot disagree. Empty once nothing is owed, which S-43 answers by sending
 * the reader on.
 */
export class ReadLegalAcceptance {
  constructor(private readonly store: LegalAcceptanceStore) {}

  async execute(query: { readonly accountId: string }): Promise<OwedLegalDocument[]> {
    const accepted = await this.store.acceptedVersions({ accountId: query.accountId });
    return documentsOwed({ accepted, inForce: LEGAL_VERSIONS_IN_FORCE });
  }
}
