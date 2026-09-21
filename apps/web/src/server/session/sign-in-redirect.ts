import 'server-only';
import { getLocale } from 'next-intl/server';
import { headers } from 'next/headers';
import { redirect } from '@/i18n/navigation';
import { REQUESTED_PATH_HEADER } from '@/lib/requested-path';
import { signInRoute } from '@/lib/routes';

/**
 * Where the api client sends a caller whose session the api has ended (tasks 160, 161; UX-136's first
 * clause, §12.5.6's task-161 row): sign-in, with the address they asked for kept as `?return=`.
 *
 * **The proxy's own shape, reached from the other side.** The proxy sends a reader holding no cookie to
 * sign-in with the same `?return=`; a reader holding a cookie for a session ended elsewhere passes it —
 * the cookie unseals and its access token is not yet due — and meets the refusal only when a request is
 * made. The address is the header the proxy stamps (`REQUESTED_PATH_HEADER`), because neither a Server
 * Component nor a Server Action is given a pathname; without it — a Route Handler the proxy does not
 * match — the reader still reaches sign-in, only without the way back.
 *
 * **Its one caller is `server/api/api-client.ts`**, which asks it of every request that carried the
 * session's bearer. Task 160 had thirteen screens call it; S-36 passed the way on it was holding rather
 * than its own address, which `completeAccountRoute` now makes unnecessary by never wrapping S-36 in
 * itself.
 *
 * **It cannot loop**: sign-in's gate serves the form to a session the api has ended, rather than sending
 * it on (`session-entry.ts`), and a public route never reads the bearer that would trigger it.
 *
 * **Inside a `Suspense` boundary the redirect arrives in the stream**, which is S-37's gate's shape too
 * (`organization-choice-gate.tsx`) — the reader lands on the form either way.
 */
export async function redirectToSignIn(): Promise<never> {
  const [requested, locale] = await Promise.all([
    headers().then((all) => all.get(REQUESTED_PATH_HEADER)),
    getLocale(),
  ]);
  return redirect({ href: signInRoute(requested), locale });
}
