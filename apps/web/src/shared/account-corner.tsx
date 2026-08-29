'use client';

import { AccountMenu, type SwitcherLocale } from '@easyesg/ui';
import type { Locale } from '@easyesg/i18n';
import { useSearchParams } from 'next/navigation';
import { Link, usePathname } from '@/i18n/navigation';
import { ROUTES } from '@/lib/routes';
import { signOutAction } from '@/features/identity/actions';

/**
 * The global tier's account corner (task 30.1) — §4.2's *user menu (profile, language, sign out)*.
 *
 * **A Client Component for one reason, and it is the same one `IdentityHeaderActions` has:**
 * language is URL state (`routing.ts`), so choosing one is a link to *this* address in another
 * locale, and the current address is knowable only in the browser. Everything else arrives as a
 * prop — the labels resolved by `GlobalTier` on the server, so the `chrome` catalogue never reaches
 * the bundle for this component.
 *
 * **Sign-out is a form outside the menu, associated by id.** Radix portals the menu to
 * `document.body`, so a `<form>` wrapping the item would be a form element inside `role="menu"`,
 * which ARIA does not admit — and a `<form>` between `Content` and `Item` is the shape that reads
 * fine and announces wrongly. HTML's `form` attribute associates a submit button with a form
 * anywhere in the document, which is exactly the case it exists for. The action is bound with no
 * return path: this is a plain "leave", not S-03's "leave and come back as somebody else" (task
 * 26.3 gave the action that parameter), and binding is what keeps the signature a form action,
 * since React would otherwise pass `FormData` into it.
 *
 * **And it submits explicitly, because the implicit submission loses a race it cannot be seen to
 * lose.** A click on a `type="submit"` button submits as the click's *default action*, after the
 * handlers; selecting a Radix menu item closes the menu in one of those handlers, so React unmounts
 * the portal — button included — before the default action runs. Nothing errors: the menu closes
 * and the person stays signed in, which is the worst shape a sign-out defect can take. So the
 * handler cancels the default and calls `requestSubmit()` on the form, which dispatches
 * synchronously while the button is still attached. Found by `e2e/web/global-tier.spec.ts`, which
 * exists for this; no unit test and no type could have seen it.
 */
const SIGN_OUT_FORM = 'global-tier-sign-out';

export interface AccountCornerLabels {
  readonly account: string;
  readonly credentials: string;
  readonly signOut: string;
  readonly language: string;
}

export interface AccountCornerProps {
  readonly email: string;
  readonly locale: Locale;
  /**
   * Every locale with its own name in that language, resolved on the server — an array rather than
   * a lookup, so this component neither reads the registry nor needs a fallback for a code the
   * catalogue is missing. A bare `ro` rendered where `Română` belongs is exactly the silent wrong
   * answer a `?? code` would produce.
   */
  readonly locales: readonly SwitcherLocale<Locale>[];
  readonly labels: AccountCornerLabels;
}

export function AccountCorner({ email, locale, locales, labels }: AccountCornerProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // The query string travels with the switch (UX-4: the address restores the state), which on this
  // tier is a filtered Index or a paginated list rather than a token — but the rule is the address,
  // not what happens to be in it.
  const query = searchParams.toString();
  const target = query ? `${pathname}?${query}` : pathname;

  const current = locales.find((entry) => entry.code === locale) ?? locales[0];

  return (
    <>
      <form id={SIGN_OUT_FORM} action={signOutAction.bind(null, undefined)} hidden />
      <AccountMenu
        label={labels.account}
        email={email}
        items={[
          {
            key: 'credentials',
            node: <Link href={ROUTES.ACCOUNT_CREDENTIALS}>{labels.credentials}</Link>,
          },
          {
            key: 'sign-out',
            node: (
              <button
                type="submit"
                form={SIGN_OUT_FORM}
                onClick={(event) => {
                  event.preventDefault();
                  event.currentTarget.form?.requestSubmit();
                }}
              >
                {labels.signOut}
              </button>
            ),
          },
        ]}
        language={{
          label: labels.language,
          current,
          locales,
          renderItem: (entry) => (
            <Link href={target} locale={entry.code}>
              {entry.label}
            </Link>
          ),
        }}
      />
    </>
  );
}
