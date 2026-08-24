import 'server-only';
import { cookies } from 'next/headers';
import {
  isSocialProvider,
  isSocialSignInIntent,
  type SocialProvider,
  type SocialSignInIntent,
} from '@easyesg/contracts';
import { SOCIAL_TRANSACTION_COOKIE } from '@/lib/session-cookie';
import { env } from '@/lib/env';
import { sealJson, unsealJson } from './session-codec';

/**
 * The OAuth transaction cookie (task 24, §12.5.6's task-24 flow row): what the web tier must
 * hold across the provider redirect, sealed so none of it — the `nonce` and PKCE verifier above
 * all — is ever readable in the browser. Written by the start Route Handler, consumed exactly
 * once by the callback; ten minutes of validity bounds an abandoned redirect.
 *
 * Same codec discipline as the session cookie: validated on the way in, never cast, and
 * anything that does not read as a transaction — tampering, expiry, a rotated secret, a
 * session cookie presented here — is the same fact, "no transaction", answered by restarting
 * the flow rather than by an error page.
 */
export interface SocialTransaction {
  provider: SocialProvider;
  intent: SocialSignInIntent;
  state: string;
  nonce: string;
  codeVerifier: string;
  redirectUri: string;
  /** Task 22's `?return=` contract, carried through the provider round trip. */
  returnPath: string | null;
  issuedAt: number;
}

const TRANSACTION_TTL_MS = 10 * 60 * 1000;

/** Path-scoped: only the start and callback handlers ever see it. */
const COOKIE_PATH = '/auth/social';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

function readTransaction(parsed: unknown): SocialTransaction | null {
  if (!isRecord(parsed)) return null;
  const { provider, intent, state, nonce, codeVerifier, redirectUri, returnPath, issuedAt } =
    parsed;
  if (
    typeof provider !== 'string' ||
    !isSocialProvider(provider) ||
    typeof intent !== 'string' ||
    !isSocialSignInIntent(intent) ||
    typeof state !== 'string' ||
    typeof nonce !== 'string' ||
    typeof codeVerifier !== 'string' ||
    typeof redirectUri !== 'string' ||
    (returnPath !== null && typeof returnPath !== 'string') ||
    typeof issuedAt !== 'number'
  ) {
    return null;
  }
  return { provider, intent, state, nonce, codeVerifier, redirectUri, returnPath, issuedAt };
}

/** Route Handler only — cookie writes throw anywhere else (the session tier's rule). */
export async function persistSocialTransaction(
  transaction: Omit<SocialTransaction, 'issuedAt'>,
): Promise<void> {
  const store = await cookies();
  store.set(
    SOCIAL_TRANSACTION_COOKIE,
    sealJson({ ...transaction, issuedAt: Date.now() } satisfies SocialTransaction, env.sessionSecret),
    {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: COOKIE_PATH,
      maxAge: TRANSACTION_TTL_MS / 1000,
    },
  );
}

/**
 * Reads AND deletes — a transaction is single-use by construction: whatever the callback
 * decides, the cookie must not survive to be replayed against a second callback.
 */
export async function consumeSocialTransaction(): Promise<SocialTransaction | null> {
  const store = await cookies();
  const sealed = store.get(SOCIAL_TRANSACTION_COOKIE)?.value;
  if (!sealed) return null;
  store.delete({ name: SOCIAL_TRANSACTION_COOKIE, path: COOKIE_PATH });
  const transaction = readTransaction(unsealJson(sealed, env.sessionSecret));
  if (!transaction || transaction.issuedAt + TRANSACTION_TTL_MS <= Date.now()) return null;
  return transaction;
}
