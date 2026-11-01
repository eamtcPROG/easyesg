import { isAcceptedLegalDocument, type AcceptedLegalDocument } from '@easyesg/i18n';
import type {
  AcceptedLegalVersions,
  NewLegalAcceptance,
} from '@api/modules/identity/account/models/legal-acceptance.model';

/**
 * `identity.legal_acceptance`'s statements (task 195; §12.5.6's task-195 row (5)), shared by the three stores that
 * touch it — registration's transaction writes an acceptance with the account, S-43's store reads and writes one, and
 * `AuthGuard`'s identity read judges one on every request. **One spelling of "the latest row per document"**, because
 * the gate and S-43 must not disagree about what an account owes: a gate that read the first row while S-43 read the
 * last would refuse an account S-43 says has accepted.
 *
 * Over anything that runs a statement — the request's `QueryRunner` or the `DataSource` — since the three callers hold
 * one each.
 */
interface Queryable {
  query(sql: string, parameters?: unknown[]): Promise<unknown>;
}

/**
 * The latest acceptance per document of the account `accountRef` names — a bind parameter or a column of an enclosing
 * statement, never a value. `id` breaks a tie inside one instant: `uuidv7()` is time-ordered.
 */
const latestPerDocument = (accountRef: string): string =>
  `SELECT DISTINCT ON (document) document, version
     FROM identity.legal_acceptance
    WHERE account_id = ${accountRef}
    ORDER BY document, accepted_at DESC, id DESC`;

/**
 * The same, as one `jsonb` value — `{ "terms": "1.0", … }`, or `NULL` where nothing was accepted — for a statement that
 * reads it beside other columns, as `AuthGuard`'s does.
 */
export const acceptedLegalVersionsColumn = (accountRef: string): string =>
  `(SELECT jsonb_object_agg(latest.document, latest.version) FROM (${latestPerDocument(accountRef)}) latest)`;

/**
 * A row's documents narrowed through the vocabulary. The `CHECK` makes a stranger impossible; the narrowing is what lets
 * the type say so without a cast.
 */
export function toAcceptedLegalVersions(column: Record<string, unknown> | null): AcceptedLegalVersions {
  const accepted: Partial<Record<AcceptedLegalDocument, string>> = {};
  for (const [document, version] of Object.entries(column ?? {})) {
    if (isAcceptedLegalDocument(document) && typeof version === 'string') accepted[document] = version;
  }
  return accepted;
}

export async function readAcceptedLegalVersions(db: Queryable, accountId: string): Promise<AcceptedLegalVersions> {
  const rows = (await db.query(`SELECT ${acceptedLegalVersionsColumn('$1')} AS accepted`, [accountId])) as {
    accepted: Record<string, unknown> | null;
  }[];
  return toAcceptedLegalVersions(rows[0]?.accepted ?? null);
}

/** One row per document accepted, all at the instant given. Nothing is ever updated: a re-acceptance adds rows. */
export async function insertLegalAcceptance(db: Queryable, acceptance: NewLegalAcceptance): Promise<void> {
  if (acceptance.accepted.length === 0) return;
  await db.query(
    `INSERT INTO identity.legal_acceptance (account_id, document, version, accepted_at)
     SELECT $1, accepted.document, accepted.version, $4
       FROM unnest($2::text[], $3::text[]) AS accepted(document, version)`,
    [
      acceptance.accountId,
      acceptance.accepted.map((entry) => entry.document),
      acceptance.accepted.map((entry) => entry.version),
      acceptance.at,
    ],
  );
}
