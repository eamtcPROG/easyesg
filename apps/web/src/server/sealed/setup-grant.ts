import 'server-only';
import { cookies } from 'next/headers';
import { env } from '@/lib/env';
import { sealJson, unsealJson } from '../session/session-codec';

/**
 * The account-setup grant, held between S-02's confirmation and S-36's password step (task 155;
 * §12.5.6's task-155 row (4)).
 *
 * **`factor-challenge.ts`'s shape, for its reason.** The grant sets an account's first password and
 * signs it in, so it must never reach the browser as a value: a sealed httpOnly cookie carries it, and
 * the page reads only whether one is held and the address it belongs to. Unlike that challenge the API
 * **does** spend this on use, so the action puts it back only where the API cannot have spent it
 * (`setup/tools/grant-put-back.ts`) — and puts back exactly what it took, expiry included, so a retry
 * cannot stretch the window it was given.
 *
 * **The expiry is the API's**, answered with the grant, never a quarter-hour restated here.
 */
const SETUP_GRANT_COOKIE = 'easyesg_setup_grant';

export interface HeldSetupGrant {
  readonly grant: string;
  /** The account's address — S-36's first step names it (`design_spec.md` S-36's content). */
  readonly email: string;
  /** Epoch-ms, as the API answered it. The cookie does not outlive what it holds. */
  readonly expiresAt: number;
  /** UX-38's deep link — S-03's invitation, when the registration began there. */
  readonly returnTo?: string;
}

export async function holdSetupGrant(held: HeldSetupGrant): Promise<void> {
  const jar = await cookies();
  jar.set(SETUP_GRANT_COOKIE, sealJson(held, env.sessionSecret), {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: Math.max(0, Math.floor((held.expiresAt - Date.now()) / 1000)),
  });
}

/** Validated, never cast — a stale or foreign shape reads as "no grant", which is S-02's resend. */
function readHeld(parsed: unknown): HeldSetupGrant | null {
  if (typeof parsed !== 'object' || parsed === null) return null;
  const { grant, email, expiresAt, returnTo } = parsed as Record<string, unknown>;
  if (typeof grant !== 'string' || typeof email !== 'string' || typeof expiresAt !== 'number') {
    return null;
  }
  if (expiresAt <= Date.now()) return null;
  return { grant, email, expiresAt, returnTo: typeof returnTo === 'string' ? returnTo : undefined };
}

/** Reads AND clears. The caller puts it back where the API cannot have spent it — see above. */
export async function consumeSetupGrant(): Promise<HeldSetupGrant | null> {
  const jar = await cookies();
  const sealed = jar.get(SETUP_GRANT_COOKIE)?.value;
  if (!sealed) return null;
  jar.delete(SETUP_GRANT_COOKIE);
  return readHeld(unsealJson({ sealed, secret: env.sessionSecret }));
}

/**
 * Reads WITHOUT clearing — what makes the password step reachable. A render must not spend it: cookie
 * writes throw during Server Component rendering (Next 16), `peekFactorChallenge`'s reason exactly.
 */
export async function peekSetupGrant(): Promise<HeldSetupGrant | null> {
  const jar = await cookies();
  const sealed = jar.get(SETUP_GRANT_COOKIE)?.value;
  return sealed ? readHeld(unsealJson({ sealed, secret: env.sessionSecret })) : null;
}
