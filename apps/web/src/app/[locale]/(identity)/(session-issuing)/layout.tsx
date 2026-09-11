import type { ReactNode } from 'react';
import { redirectWhenSignedIn } from '@/server/session/session-entry';
import { activateRequestLocale, type LocaleParams } from '@/i18n/page';

/**
 * The gate's second direction, in **one** place (task 112).
 *
 * §4.3 is entered by an address as well as by a submission, and UX-136 makes it a gate both ways:
 * a request for a screen whose completion **issues** a session, from a caller who already holds
 * one, is answered by resolving the branch — never by the form. Served the form again, a signed-in
 * reader who submits it calls `establishSession` and **replaces their live session in place**, on
 * `/register` as a different account, with nothing on screen saying so.
 *
 * **A route group rather than a call in each page, and the first draft was the call in each page.**
 * That draft was the defect task 105 was raised against wearing different clothes: a rule every
 * consumer has to remember is not one rule, it is N copies of it, and the copy that goes missing is
 * invisible — a screen added here without the line would simply not be guarded, and no gate could
 * say so. Route groups add no URL segment, so membership of this directory **is** the predicate:
 * a page inside is gated, a page outside is not, and there is nothing to forget. It is the
 * filesystem's own statement of `route-access.ts`'s `SESSION_ISSUING_SEGMENTS`, which the proxy
 * reads for the same two routes when it decides whether to rotate.
 *
 * **`/sign-in/factor` is inside, and that is right rather than incidental.** It is a step of
 * sign-in, so a caller who already holds a session has no business on it either; in the ordinary
 * flow the session does not exist yet — only the sealed challenge — so the guard does not fire and
 * the step keeps its own `peekFactorChallenge` bounce.
 *
 * **What a layout cannot see is `searchParams`**, so a `?return=` on the incoming address is not
 * honoured here and the branch's own destination wins. That is the trade this shape costs, and it
 * is small: a `?return=` reaching a request that *already* carries a session is a leftover from a
 * bounce something else has since answered, not UX-38's mid-work expiry — which never lands here,
 * because that reader has no session. The one case it costs is a registration handed off from S-03
 * whose visitor signed in elsewhere between the hand-off and the reload; they land on their own
 * home instead of the invitation, and the emailed link still works.
 *
 * `(identity)`'s `FocusShell` is above this, so this layout adds no chrome — it exists for the
 * `await` on the line below and renders its children unchanged.
 */
export default async function SessionIssuingLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: LocaleParams;
}) {
  // `activateRequestLocale` rather than a bare `await params`: it pins the locale with
  // `setRequestLocale`, which is what `api-client` reads for `Accept-Language` on the membership
  // call the guard makes. `requestLocale` would resolve the same value from the URL — layouts and
  // pages render in parallel, so the root layout's pin does not reach here (`i18n/page.ts`) — and
  // pinning it makes the header a fact rather than a fallback.
  const locale = await activateRequestLocale(params);
  await redirectWhenSignedIn({ locale });

  return children;
}
