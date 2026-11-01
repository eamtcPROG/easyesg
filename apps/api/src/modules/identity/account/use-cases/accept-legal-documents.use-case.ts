import { LEGAL_VERSIONS_IN_FORCE, type LegalVersions } from '@easyesg/i18n';
import type { Clock } from '@api/contracts/clock.port';
import { documentsOwed, presentsVersionsInForce } from '../domain/legal-acceptance';
import { LegalVersionChangedError } from '../errors/account.errors';
import type { LegalAcceptanceStore } from '../interfaces/legal-acceptance-store.interface';

export interface AcceptLegalDocumentsCommand {
  readonly accountId: string;
  /** The versions S-43 displayed when the reader ticked that they accept them. */
  readonly legalVersions: LegalVersions;
}

/**
 * S-43's *Continue* (task 195; §12.5.6's task-195 row (1), (2), (5); FR-205 behaviour 8, UC-02 step 7).
 *
 * **The versions presented must be the versions in force**, or the page was read before a release replaced a text and
 * nothing is recorded (`legal-version-changed`). **One row per document owed**, at the version presented — which is the
 * version in force — and nothing for a document already accepted at it: a row means *accepted this version at this
 * time*, so a second one for an acceptance that did not change would say something nobody did. Nothing owed is a
 * success: the reader pressed *Continue* on a page another tab had already answered, and is sent on either way.
 */
export class AcceptLegalDocuments {
  constructor(
    private readonly store: LegalAcceptanceStore,
    private readonly now: Clock,
  ) {}

  async execute(command: AcceptLegalDocumentsCommand): Promise<void> {
    if (!presentsVersionsInForce({ presented: command.legalVersions, inForce: LEGAL_VERSIONS_IN_FORCE })) {
      throw new LegalVersionChangedError();
    }

    const accepted = await this.store.acceptedVersions({ accountId: command.accountId });
    const owed = documentsOwed({ accepted, inForce: LEGAL_VERSIONS_IN_FORCE });
    if (owed.length === 0) return;

    await this.store.record({
      accountId: command.accountId,
      accepted: owed.map(({ document, version }) => ({ document, version })),
      at: this.now(),
    });
  }
}
