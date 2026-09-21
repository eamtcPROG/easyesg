import 'server-only';
import { getLocale } from 'next-intl/server';
import { headers } from 'next/headers';
import { redirect } from '@/i18n/navigation';
import { REQUESTED_PATH_HEADER } from '@/lib/requested-path';
import { signInRoute } from '@/lib/routes';

/**
 * Where a screen sends a reader whose session the api has ended, learned from its own read during render
 * (task 160; UX-136's first clause, §12.5.6's task-160 row): sign-in, with the address they asked for kept
 * as `?return=`.
 *
 * **The proxy's own shape, reached from the other side.** The proxy sends a reader holding no cookie to
 * sign-in with the same `?return=`; a reader holding a cookie for a session ended elsewhere passes it —
 * the cookie unseals and its access token is not yet due — and meets the refusal only when a screen reads.
 * Until task 160 every such screen drew *try again later*, which no retry could fix. The address is the
 * header the proxy stamps (`REQUESTED_PATH_HEADER`), because a Server Component is given no pathname;
 * without it the reader still reaches sign-in, only without the way back.
 *
 * **It cannot loop**: sign-in's gate serves the form to a session the api has ended, rather than sending
 * it on (`session-entry.ts`).
 *
 * **Rendered inside a `Suspense` boundary the redirect arrives in the stream**, which is S-37's gate's
 * shape too (`organization-choice-gate.tsx`) — the reader lands on the form either way.
 *
 * **A screen whose own address is a hand-off passes the way back it holds instead** — S-36, whose
 * `?return=` is where setup leads next: its own address would put one return inside another, and
 * signing in brings an account still in setup back to S-36 on its own.
 */
export async function redirectToSignIn(input?: {
  /** The way back to keep, where it is not the address asked for; `null` keeps none. */
  readonly returnTo: string | null;
}): Promise<never> {
  const [requested, locale] = await Promise.all([
    input === undefined ? headers().then((all) => all.get(REQUESTED_PATH_HEADER)) : input.returnTo,
    getLocale(),
  ]);
  return redirect({ href: signInRoute(requested), locale });
}
