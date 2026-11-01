/**
 * What the dialogue sends the two re-authentication handlers, and the one place their bodies are read
 * (task 92) — so a handler acts on a shape it has checked, never on one it has cast.
 *
 * **The account is named by the page, not proven by it.** `accountId` and `email` come from the session
 * the screen was rendered under, round-tripped through the browser, and that is enough for what they do:
 * `email` is what the api signs in, which it would take from anyone on S-01, and `accountId` is compared
 * with the session the api answers — a consistency check that keeps a queue from being sent as the wrong
 * person (task 35.2), not an authentication. `remembered` decides only how long this browser keeps the
 * cookie, which is the reader's own business, and it is carried forward from the session that ended as
 * rotation carries it. `organizationId` is the organization the screen was read under, restored on the
 * new session (`architecture.md` §12.5.6's task-92 row) — the api decides whether it still may be.
 */

/** The account a dialogue is bound to — the page's session, as it was when the page was read. */
export interface ReauthenticatingAccount {
  readonly id: string;
  readonly email: string;
  readonly remembered: boolean;
}

export interface PasswordCommand {
  readonly accountId: string;
  readonly email: string;
  readonly password: string;
  readonly remembered: boolean;
  readonly organizationId: string | null;
}

export interface FactorCommand {
  readonly accountId: string;
  readonly code: string;
  readonly organizationId: string | null;
}

const isText = (value: unknown): value is string => typeof value === 'string' && value.length > 0;

const isOrganization = (value: unknown): value is string | null => value === null || isText(value);

const fieldsOf = (body: unknown): Record<string, unknown> | null =>
  typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : null;

/** `null` for anything that is not a password submission — the handler answers `400`. */
export function readPasswordCommand(body: unknown): PasswordCommand | null {
  const fields = fieldsOf(body);
  if (fields === null) return null;
  const { accountId, email, password, remembered, organizationId } = fields;
  if (!isText(accountId) || !isText(email) || !isText(password)) return null;
  if (typeof remembered !== 'boolean' || !isOrganization(organizationId)) return null;
  return { accountId, email, password, remembered, organizationId };
}

/** `null` for anything that is not a code submission — the handler answers `400`. */
export function readFactorCommand(body: unknown): FactorCommand | null {
  const fields = fieldsOf(body);
  if (fields === null) return null;
  const { accountId, code, organizationId } = fields;
  if (!isText(accountId) || !isText(code) || !isOrganization(organizationId)) return null;
  return { accountId, code, organizationId };
}
