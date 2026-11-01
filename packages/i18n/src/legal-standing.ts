/**
 * The legal set and each document's standing — its version, the day it applies from, and whether counsel has approved
 * it (FR-205 behaviour 5 and 10, AC-4, AC-10; 182/116; `architecture.md` §12.5.6's task-75 row (9)).
 *
 * **Committed with the release, because the text is the release's**: the release that carries a document supplies its
 * version and its effective date, so neither can change without the words changing with them. **Here rather than beside
 * the text in `apps/web` since task 195** (§12.5.6's task-195 row (1)): the api records which version an account
 * accepted and refuses one that is not in force, and it may not import `@easyesg/contracts` — so the one copy both tiers
 * read is this package's, which ships in the same release as the text it versions. FR-111's checkout record will point
 * at the same versions.
 *
 * **The effective date is a legal date, a calendar day in Chișinău** (NFR-34), never an instant: which version was in
 * force on a day is a legal question. Structurally the wire's `LegalDate`, which this package cannot name.
 *
 * **`provisional` is true until counsel approves the text** — the release-checklist item before task 48
 * (`docs/runbooks/release-checklist.md`), which also sets the effective date and drops the marking. **Counsel has
 * checked the first version** (project owner, 30 Oct 2026; task 226), so no document of the set is marked, and it keeps
 * its effective date: the approved text is the one accounts had already accepted as 1.0. A later version — the one
 * billing brings — is drafted provisional again. A platform operator's details are not part of the standing: A-21
 * changes them without versioning the documents (row (7)).
 */

/**
 * The legal set (FR-205; 182/121): the terms of service, the privacy notice and the cookie policy — three, the
 * prototype's data processing agreement and sub-processor list not being published. A document's value is its address
 * segment in `apps/web`, `/legal/<document>`, and the record's `document` in `identity.legal_acceptance`.
 */
export const LEGAL_DOCUMENT = {
  TERMS: 'terms',
  PRIVACY: 'privacy',
  COOKIES: 'cookies',
} as const;

export type LegalDocument = (typeof LEGAL_DOCUMENT)[keyof typeof LEGAL_DOCUMENT];

const DOCUMENTS: ReadonlySet<string> = new Set(Object.values(LEGAL_DOCUMENT));

/** Whether a value names one of the three — anything else is a page that does not exist. */
export const isLegalDocument = (value: string): value is LegalDocument => DOCUMENTS.has(value);

/**
 * The two a person accepts (task 195). The cookie policy informs and asks nothing (FR-206), so it is not among them —
 * `identity.legal_acceptance`'s `CHECK` is the database's copy of this list.
 */
export const ACCEPTED_LEGAL_DOCUMENTS = [LEGAL_DOCUMENT.TERMS, LEGAL_DOCUMENT.PRIVACY] as const;

export type AcceptedLegalDocument = (typeof ACCEPTED_LEGAL_DOCUMENTS)[number];

const ACCEPTED: ReadonlySet<string> = new Set(ACCEPTED_LEGAL_DOCUMENTS);

/** Whether a value names a document a person accepts — the narrowing a stored row's `document` is read through. */
export const isAcceptedLegalDocument = (value: string): value is AcceptedLegalDocument => ACCEPTED.has(value);

export interface LegalStanding {
  readonly version: string;
  readonly effective: { readonly date: string; readonly timezone: string };
  readonly provisional: boolean;
}

/** The zone a legal document's effective date is a day in — the operator's, Moldova's. */
const LEGAL_TIMEZONE = 'Europe/Chisinau';

/** The first version, as counsel checked it (task 226). */
const FIRST_VERSION: LegalStanding = {
  version: '1.0',
  effective: { date: '2026-10-13', timezone: LEGAL_TIMEZONE },
  provisional: false,
};

/**
 * The privacy notice's second version (task 77; `architecture.md` §12.5.6's task-77 row (11)): what a support request
 * keeps, why, and for how long. **Provisional until counsel approves it** — the release checklist's item — and dated the
 * day it was drafted; every account that accepted 1.0 accepts it again (task 195).
 */
const PRIVACY_SUPPORT_REQUESTS: LegalStanding = {
  version: '1.1',
  effective: { date: '2026-10-31', timezone: LEGAL_TIMEZONE },
  provisional: true,
};

export const LEGAL_STANDING: Readonly<Record<LegalDocument, LegalStanding>> = {
  [LEGAL_DOCUMENT.TERMS]: FIRST_VERSION,
  [LEGAL_DOCUMENT.PRIVACY]: PRIVACY_SUPPORT_REQUESTS,
  [LEGAL_DOCUMENT.COOKIES]: FIRST_VERSION,
};

/** A version of each accepted document — what a page displayed, what an account accepted, what is in force. */
export type LegalVersions = Readonly<Record<AcceptedLegalDocument, string>>;

/**
 * The versions in force (task 195): what S-01 and S-43 present, and what the api admits. Derived from the standing, so
 * moving a version is the one edit above and every account that accepted the older one owes an acceptance again.
 */
export const LEGAL_VERSIONS_IN_FORCE: LegalVersions = {
  [LEGAL_DOCUMENT.TERMS]: LEGAL_STANDING[LEGAL_DOCUMENT.TERMS].version,
  [LEGAL_DOCUMENT.PRIVACY]: LEGAL_STANDING[LEGAL_DOCUMENT.PRIVACY].version,
};
