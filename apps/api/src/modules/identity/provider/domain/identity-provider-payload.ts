/**
 * A social provider's behaviour as the configuration store holds it (FR-82; §12.5.6's task-24
 * configuration row) — what `config/seed/identity-provider.<provider>.json` seeds, what the sign-in flows
 * resolve, and what A-18 edits.
 *
 * **Here rather than private to the catalog service since task 67.11**, which gave it a second reader: A-18's
 * store reads the payload in force through the same narrowing the sign-in flow does, so a payload one of
 * them accepts cannot be one the other refuses.
 */
export interface IdentityProviderPayload {
  readonly enabled: boolean;
  readonly clientId: string;
  readonly issuer: string;
  readonly scopes: readonly string[];
  readonly redirectUris: readonly string[];
}

/**
 * FR-2's three — the identifier, the email address and the display name, and nothing further. **Fixed, and
 * written by every A-18 publication** (project owner, 14 Sep 2026, task 67.11): FR-2 forbids a fourth, and
 * the flow cannot match or register an account without the first two.
 */
export const REQUESTED_SCOPES = ['openid', 'email', 'profile'] as const;

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((entry) => typeof entry === 'string');

/**
 * Validated, never cast — configuration is data someone edits, and a malformed payload must surface as
 * "this provider is unavailable" plus an operator-facing log line, not as an `undefined` threading itself
 * into an authorization URL. A field the shape does not name is dropped rather than carried.
 */
export const readIdentityProviderPayload = (
  payload: Record<string, unknown>,
): IdentityProviderPayload | null => {
  if (
    typeof payload.enabled !== 'boolean' ||
    typeof payload.clientId !== 'string' ||
    typeof payload.issuer !== 'string' ||
    !isStringArray(payload.scopes) ||
    !isStringArray(payload.redirectUris)
  ) {
    return null;
  }
  return {
    enabled: payload.enabled,
    clientId: payload.clientId,
    issuer: payload.issuer,
    scopes: payload.scopes,
    redirectUris: payload.redirectUris,
  };
};
