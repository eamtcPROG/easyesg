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
/**
 * **Never prerendered — moved here from the root layout by task 74.4** (`architecture.md` §12.5.6's task-74 row (3)).
 * The root forces nothing since the marketing home became the one static page, so a group outside the public zone says
 * so itself, as `(app)` always has. These screens hold no tenant data, but §14.2 permits the framework's cache to the
 * public zone alone, and a screen here that reads nothing would otherwise be prerendered silently.
 */
export const dynamic = 'force-dynamic';

export default async function IdentityLayout({ children }: { children: ReactNode }) {
  const t = await getTranslations('chrome');

  return (
    <FocusShell
      brand={
        // **Not prefetched** (task 74.4), for `public-header.tsx`'s reason: the landing is static since that task, and
        // the router prefetches a static page in segments it partly leaves unread, holding requests open for the life of
        // the page — found as `networkidle` never arriving on S-36.
        <Link href="/" prefetch={false} aria-label={t('brandHome')}>
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
