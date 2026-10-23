import type { AcceptedLegalVersions, NewLegalAcceptance } from '../models/legal-acceptance.model';

/**
 * S-43's store over `identity.legal_acceptance` (task 195). **Keyed by the account alone**, which is always the
 * session's, as for every `/account/*` store: an acceptance is the person's, made before any organization exists.
 *
 * Registration writes its acceptance through `AccountTransaction` instead, in the account's own transaction — the two
 * share one set of statements (`legal-acceptance.queries.ts`), so they cannot write differently.
 */
export interface LegalAcceptanceStore {
  /** The latest version accepted, per document; empty where the account accepted none. */
  acceptedVersions(query: { readonly accountId: string }): Promise<AcceptedLegalVersions>;
  record(acceptance: NewLegalAcceptance): Promise<void>;
}

export const LEGAL_ACCEPTANCE_STORE = Symbol('LEGAL_ACCEPTANCE_STORE');
