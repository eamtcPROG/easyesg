import { ACCEPTED_LEGAL_DOCUMENTS, type LegalVersions } from '@easyesg/i18n';
import type { AcceptedLegalVersions, LegalAcceptanceEntry, OwedLegalDocument } from '../models/legal-acceptance.model';

/**
 * Which documents an account owes an acceptance of (task 195; §12.5.6's task-195 row (2)): each accepted document whose
 * latest acceptance is absent or names a version other than the one in force — an account created before acceptance
 * was recorded, one registered through a provider, and every account once a release moves a version.
 *
 * **`inForce` is a parameter rather than an import**, so the rule is a line of spec for any pair of versions; its callers
 * pass `@easyesg/i18n`'s `LEGAL_VERSIONS_IN_FORCE`. Both members are records of the same shape, which is why they are
 * named.
 */
export const documentsOwed = (input: {
  readonly accepted: AcceptedLegalVersions;
  readonly inForce: LegalVersions;
}): OwedLegalDocument[] =>
  ACCEPTED_LEGAL_DOCUMENTS.filter((document) => input.accepted[document] !== input.inForce[document]).map(
    (document) => ({
      document,
      version: input.inForce[document],
      acceptedVersion: input.accepted[document] ?? null,
    }),
  );

/** Whether anything is owed — the question `AuthGuard` asks on every request. */
export const owesLegalAcceptance = (input: {
  readonly accepted: AcceptedLegalVersions;
  readonly inForce: LegalVersions;
}): boolean => documentsOwed(input).length > 0;

/**
 * Whether a page presented the versions in force (§12.5.6's task-195 row (1)). A registration or an acceptance carries
 * the versions it displayed; one carrying any other was read before a release replaced the text, and recording it would
 * say the person accepted words they were never shown.
 */
export const presentsVersionsInForce = (input: {
  readonly presented: LegalVersions;
  readonly inForce: LegalVersions;
}): boolean => ACCEPTED_LEGAL_DOCUMENTS.every((document) => input.presented[document] === input.inForce[document]);

/** Every accepted document at the version presented — what registration records, since it accepts both at once. */
export const acceptanceOfEvery = (presented: LegalVersions): LegalAcceptanceEntry[] =>
  ACCEPTED_LEGAL_DOCUMENTS.map((document) => ({ document, version: presented[document] }));
