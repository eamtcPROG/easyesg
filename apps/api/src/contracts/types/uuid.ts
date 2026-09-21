/**
 * The textual form of a UUID (RFC 9562), **any version and either case** — whether an unvalidated value can be
 * handed to PostgreSQL as a `uuid` at all (task 162).
 *
 * **Why it exists: a malformed id is a question with the answer *nothing*, not a 500.** A value cast as `$1::uuid`
 * or `ANY($1::uuid[])` that is not a UUID makes PostgreSQL refuse the whole statement with `invalid input syntax for
 * type uuid` — so an unknown session id would answer 500 instead of 401, one bad recipient id would lose every
 * other recipient's notice, and a hand-edited filter would break the page it was meant to narrow. Each caller asks
 * this first and treats *no* as *not found*, *skipped* or *filter dropped*, whichever its own reason is.
 *
 * **Any version, deliberately**: the version nibble is not checked. The database mints v7 ids (`uuidv7()`) and this
 * tier v4 ones (`randomUUID()` — an outbox key, a correlation id), and a narrower pattern would reject a valid id
 * minted by a later version. **Either case**, because PostgreSQL accepts both and answers the same row.
 *
 * **Here, in `contracts/types/`, rather than in persistence**, because its callers are on both sides of the
 * dependency rule: repositories, and a domain query narrower (`system-audit-log-query.ts`) that may not import
 * infrastructure. It imports nothing, so `contracts-is-a-leaf` holds — `time.ts` beside it is the precedent for a
 * primitive's narrowing living with it. The copies it replaced were one value, measured rather than assumed (task
 * 162's build-log entry).
 */
const UUID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

export const isUuid = (value: unknown): value is string => typeof value === 'string' && UUID_SHAPE.test(value);
