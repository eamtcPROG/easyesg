import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import type { AdminAccount } from '@easyesg/contracts';
import { AccountMenu, GLOBAL_BAR_TONE } from '@easyesg/ui';
import { useTranslations } from 'use-intl';
import { ADMIN_SESSION_QUERY_KEY, signOut } from '../../queries/session';

/**
 * The console's account corner (task 67.1) — the inventory's `AccountMenu` on the console's band,
 * replacing task 23's interim strip, and owning the sign-out that `_realm.tsx` used to wire.
 *
 * **The address is the name, and there is no monogram.** An administrator account holds an address
 * and a role and nothing else, so UX-137's fallback applies: the address stands in for a display name
 * and the avatar shows its glyph rather than an initial cut from an email. **There is no language
 * row**: the console is Romanian-only (architecture.md OQ-42), so the menu is handed `null`.
 *
 * **A-19, the operator's own credentials, is the first item** (task 151), for both privilege levels —
 * here rather than in the console navigation, which is drawn per realm, so a personal screen filed
 * under *Platformă* or *Facturare* would read as that realm's work (`design_spec.md` §5.2 A-19). It is
 * the router's `Link`, so the move is a client-side transition like the navigation's; Radix slots the
 * item onto its anchor, which is safe because every caller of this menu here is a Client Component.
 *
 * **Sign-out is a button's click, not a form's submission**, and the difference is why this is safe
 * where `apps/web`'s account corner needed `requestSubmit()`: that trap was a submit's *default
 * action* running after Radix had unmounted the menu. A click handler runs first, synchronously, and
 * the mutation it starts does not need the button to still be there.
 *
 * **Settled, not success**: the cookie is cleared even when the api was unreachable — the service's
 * own stance — so the console's view follows, and the operator leaves either way.
 */
export function ConsoleAccount({ account }: { readonly account: AdminAccount }) {
  const t = useTranslations('realm.chrome');
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const signOutMutation = useMutation({
    mutationFn: signOut,
    onSettled: async () => {
      queryClient.setQueryData(ADMIN_SESSION_QUERY_KEY, null);
      await navigate({ to: '/sign-in' });
    },
  });

  return (
    <AccountMenu
      tone={GLOBAL_BAR_TONE.CONSOLE}
      label={t('account')}
      email={account.email}
      displayName={account.email}
      monogram={null}
      language={null}
      items={[
        {
          key: 'credentials',
          node: <Link to="/credentials">{t('credentials')}</Link>,
        },
        {
          key: 'sign-out',
          node: (
            <button
              type="button"
              disabled={signOutMutation.isPending}
              onClick={() => signOutMutation.mutate()}
            >
              {t('signOut')}
            </button>
          ),
        },
      ]}
    />
  );
}
