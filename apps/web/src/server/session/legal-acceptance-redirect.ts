import 'server-only';
import { getLocale } from 'next-intl/server';
import { headers } from 'next/headers';
import { redirect } from '@/i18n/navigation';
import { REQUESTED_PATH_HEADER } from '@/lib/requested-path';
import { acceptTermsRoute } from '@/lib/routes';

/**
 * Where the api client sends a caller whose account owes an acceptance of the terms or the privacy notice in force
 * (task 195; §12.5.6's task-195 row (2)): S-43, with the address they asked for kept as `?return=`.
 *
 * **`sign-in-redirect.ts`'s shape, for the same reason**: the fact is the api's and arrives with a refusal, so the
 * address is the header the proxy stamps (`REQUESTED_PATH_HEADER`), since neither a Server Component nor a Server
 * Action is given a pathname. **Its one caller is `server/api/api-client.ts`.**
 *
 * **It cannot loop**: S-43's two reads are the api's exceptions for such an account, so nothing S-43 asks is refused
 * this way, and `acceptTermsRoute` never wraps S-43 in itself.
 */
export async function redirectToLegalAcceptance(): Promise<never> {
  const [requested, locale] = await Promise.all([
    headers().then((all) => all.get(REQUESTED_PATH_HEADER)),
    getLocale(),
  ]);
  return redirect({ href: acceptTermsRoute(requested), locale });
}
