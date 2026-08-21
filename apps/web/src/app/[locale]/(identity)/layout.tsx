import { BrandMark, FocusShell } from '@easyesg/ui';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { IdentityFooter, IdentityHeaderActions } from '@/features/identity/components/identity-chrome';
import { Link } from '@/i18n/navigation';

/**
 * Identity — S-01, S-02, S-03 (IMPLEMENTATION_PLAN Phase 2).
 *
 * Every screen here is the **Focus** archetype: one task, one panel, no navigation, single
 * centred column, one primary action. That is why this layout exists as a sibling of `(app)`
 * rather than inside it — there is no session yet, so there is no global tier to render.
 *
 * The client provider is namespace-scoped on purpose: the root layout mounts
 * `NextIntlClientProvider messages={null}` so the full catalogue never reaches the browser
 * (NFR-43); these screens' client components need exactly `identity` and `chrome`, so exactly
 * those ship.
 */
export default async function IdentityLayout({ children }: { children: ReactNode }) {
  const t = await getTranslations('chrome');
  const messages = await getMessages();

  return (
    <NextIntlClientProvider
      messages={{ identity: messages.identity, chrome: messages.chrome }}
    >
      <FocusShell
        brand={
          <Link href="/" aria-label={t('brandHome')}>
            <BrandMark />
          </Link>
        }
        actions={<IdentityHeaderActions />}
        footer={<IdentityFooter />}
      >
        {children}
      </FocusShell>
    </NextIntlClientProvider>
  );
}
