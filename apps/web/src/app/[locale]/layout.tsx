import type { ReactNode } from 'react';
import { NextIntlClientProvider, hasLocale } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import '../globals.css';

/**
 * The root layout. There is deliberately no `src/app/layout.tsx` above this one: every path
 * outside `[locale]` is a Route Handler (`/health`, `/api/[...path]`), and Route Handlers need
 * no layout — so `<html>` belongs here, where the locale that fills its `lang` is known.
 */
type Props = {
  children: ReactNode;
  params: Promise<{ locale: string }>;
};

/**
 * No page under this layout bakes its copy into the build artefact.
 *
 * NFR-85 requires a content-only change — labels, help text, validation messages — to reach
 * production within one working day of approval and to be revertible in a single step. Wording
 * is versioned configuration published from the admin console (FR-61, FR-62), so a page
 * prerendered with its strings would need a REDEPLOY to change a sentence. That is the
 * requirement inverted, and it would have been invisible: the build succeeds and the copy is
 * simply stale.
 *
 * §14.2's carve-out permits caching "the marketing shell, the legal pages, the locale bundles" —
 * a cache with revalidation, not a permanent bake at build time. `(app)` additionally declares
 * this for the stronger, tenancy reason.
 *
 * `generateStaticParams` still earns its place: it is how next-intl knows the locale set for
 * routing and alternate links.
 */
export const dynamic = 'force-dynamic';

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;

  // `[locale]` acts as a catch-all for unknown paths, so an unrecognised value is a 404 rather
  // than a reason to guess a language.
  if (!hasLocale(routing.locales, locale)) notFound();

  setRequestLocale(locale);

  return (
    <html lang={locale}>
      <body>
        {/*
          `messages={null}` is deliberate and load-bearing.

          The default ships EVERY message to the client. This catalogue is every B1-B11 field
          label, help text and validation message across three locales - a payload that works
          directly against NFR-43 (LCP <= 2.5 s, INP <= 200 ms at p75 on 4G mid-range).

          It also fits AD-9's split exactly: Server Components render the shell, navigation,
          list views and export preview, and only the wizard's field-level interaction is a
          Client Component. So the wizard segment wraps itself in a namespace-scoped provider
          and nothing else needs messages in the browser at all.
        */}
        <NextIntlClientProvider messages={null}>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
