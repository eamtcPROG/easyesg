import { BrandMark, FocusShell } from '@easyesg/ui';
import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { IdentityHeaderActions } from '@/features/identity/shared/components/identity-chrome';
import { SiteFooter } from '@/shared/site-footer';
import { Link } from '@/i18n/navigation';

/**
 * Identity — S-01, S-02, S-03 (IMPLEMENTATION_PLAN Phase 2).
 *
 * Every screen here is the **Focus** archetype: one task, one panel, no navigation, single
 * centred column, one primary action. That is why this layout exists as a sibling of `(app)`
 * rather than inside it — there is no session yet, so there is no global tier to render.
 *
 * The client provider is namespace-scoped on purpose: the root layout mounts
 * **It mounts no message provider since task 99.** It used to, because the root layout shipped
 * `messages={null}` and a namespace reached the browser only by being named — a scoping built to
 * keep the B1–B11 label set out of the bundle, which OQ-58 has served through the API since
 * 1 Sep 2026. What is left is 14.4 KB gzipped, provided once at the root.
 */
export default async function IdentityLayout({ children }: { children: ReactNode }) {
  const t = await getTranslations('chrome');

  return (
    <FocusShell
      brand={
        <Link href="/" aria-label={t('brandHome')}>
          <BrandMark />
        </Link>
      }
      actions={<IdentityHeaderActions />}
      footer={<SiteFooter />}
    >
      {children}
    </FocusShell>
  );
}
