'use client';

import { AccountMenu } from '@easyesg/ui';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { Link, usePathname } from '@/i18n/navigation';
import { ROUTES } from '@/lib/routes';
import { useSignOut } from '@/features/identity/shared/components/sign-out-provider';
import { useLocaleNames } from './use-locale-names';

/**
 * The global tier's account corner (task 30.1) — §4.2's *user menu (profile, language, sign out)*.
 *
 * **A Client Component for one reason, and it is the same one `LocaleChoice` has:** language is URL
 * state (`routing.ts`), so choosing one is a link to *this* address in another locale, and the
 * current address is knowable only in the browser. The account arrives as props, because only the
 * server reads the session (AD-9).
 *
 * **Its words are its own** (task 158): `useTranslations('chrome')`, against the catalogue the root
 * provider already serves every page. They used to arrive as a `labels` prop resolved by `GlobalTier`,
 * so that *"the `chrome` catalogue never reaches the bundle"* — a reason task 99's single provider had
 * already ended; `architecture.md` §12.5.6's task-158 row records the rule that replaced it.
 *
 * **Sign-out is a form outside the menu, associated by id** — and since task 93 that form is the
 * `(app)` layout's, in `SignOutProvider`, which the drawer's control shares. Radix portals the menu to
 * `document.body`, so a `<form>` wrapping the item would be a form element inside `role="menu"`, which
 * ARIA does not admit — and a `<form>` between `Content` and `Item` is the shape that reads fine and
 * announces wrongly. HTML's `form` attribute associates a submit button with a form anywhere in the
 * document, which is exactly the case it exists for, and it is what still signs a reader out before
 * hydration.
 *
 * **Once hydrated the press is handed over, and that is what the implicit submission could never
 * do.** A click on a `type="submit"` button submits as the click's *default action*, after the
 * handlers; selecting a Radix menu item closes the menu in one of those handlers, so React unmounts
 * the portal — button included — before the default action runs. Nothing errors: the menu closes
 * and the person stays signed in, which is the worst shape a sign-out defect can take. The handler
 * therefore cancels the default and asks the provider, which is above the menu and so outlives its
 * closing — and being above it is also what lets a sign-out wait for unsent answers (UX-37, task 93).
 * The race was found by `e2e/web/global-tier.spec.ts`, which exists for it; no unit test and no type
 * could have seen it.
 */

export interface AccountCornerProps {
  readonly email: string;
  /** UX-137's derived pair, computed once by the api and carried on the session. */
  readonly displayName: string;
  readonly monogram: string | null;
}

export function AccountCorner({ email, displayName, monogram }: AccountCornerProps) {
  const t = useTranslations('chrome');
  const { formId, requestSignOut } = useSignOut();
  const { locale, locales } = useLocaleNames();
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
      <AccountMenu
        label={t('accountMenu.label')}
        email={email}
        displayName={displayName}
        monogram={monogram}
        items={[
          // S-27, the global tier's way to it (task 52.3; `design_spec.md` S-27's entry points).
          { key: 'profile', node: <Link href={ROUTES.ACCOUNT}>{t('accountMenu.profile')}</Link> },
          {
            key: 'credentials',
            node: <Link href={ROUTES.ACCOUNT_CREDENTIALS}>{t('accountMenu.credentials')}</Link>,
          },
          {
            key: 'sign-out',
            node: (
              <button
                type="submit"
                form={formId}
                onClick={(event) => {
                  event.preventDefault();
                  requestSignOut();
                }}
              >
                {t('accountMenu.signOut')}
              </button>
            ),
          },
        ]}
        language={{
          label: t('language'),
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
