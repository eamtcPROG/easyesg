import { answerOneClick } from '@/features/identity/unsubscribe/handlers/one-click';

/**
 * `/mail/unsubscribe/{token}` — RFC 8058's one-click target (task 52.2.2; FR-169), the address an optional email's
 * `List-Unsubscribe` header names.
 *
 * **Outside `[locale]` and outside the proxy's matcher**, as `/auth/…` is: a mail client posts here with no session
 * and no language, and the source locale is served unprefixed, so S-38's own path and a handler at the same address
 * would be one route. `POST` only — `List-Unsubscribe-Post` is what tells a client to post rather than open the URL. A
 * shell: the flow is `features/identity/unsubscribe/handlers/`.
 */
type Context = { params: Promise<{ token: string }> };

export async function POST(_request: Request, { params }: Context) {
  const { token } = await params;
  return answerOneClick(token);
}
