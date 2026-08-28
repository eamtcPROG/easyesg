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
 * No page under this layout is prerendered — and this is an OPEN decision held open, not a
 * closed one. Whether `(public)` and `(identity)` may be un-forced is §14.2's own carve-out
 * question, which permits static rendering for "the marketing shell, the legal pages, the locale
 * bundles" and has never been applied to a specific route group.
 *
 * **The justification here was rewritten 28 Aug 2026, because the one it carried had expired.**
 * It argued NFR-85: wording is versioned configuration (FR-61, FR-62), so prerendering a page
 * with its strings would need a redeploy to change a sentence — the requirement inverted, and
 * invisibly so. That stopped being true when OQ-43 (19 Aug 2026) narrowed config-as-data to
 * behaviour rather than wording, and `src/server/messages.ts` implements the narrowing by
 * importing the catalogues as JSON. Labels are bundled at build time already; prerendering costs
 * nothing in freshness. Only help-centre articles and plan presentation copy stayed in the store,
 * and those surfaces are the public tier — tasks 74 … 77, unbuilt — which is the real reason the
 * question cannot be settled today rather than a reason to force dynamic rendering forever.
 *
 * What is NOT in question, and does not rest on this line: `(app)` declares its own
 * `force-dynamic` on §14.2's tenancy argument, the third leg of a rule whose other two are
 * `cacheComponents: false` and the ESLint ban on `"use cache"`. Deleting this changes nothing
 * there.
 *
 * One coupling to know before touching either: `setRequestLocale` is the PRECONDITION for static
 * rendering, and `src/i18n/page.ts` keeps those calls alive so this option stays open. With this
 * line present they are redundant; without it they are load-bearing. Deleting both is the one
 * combination that breaks, and it breaks quietly — every reader served the source locale.
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

  // Deprecated in favour of `next/root-params`, and called anyway: OQ-39 defers that migration
  // because root params are unsupported in Route Handlers AND Server Actions, which is how this
  // app reaches the API. next-intl keeps this API supported for exactly that reason. The call is
  // per-layout and per-page (`src/i18n/page.ts` says why it cannot be hoisted, and why
  // `force-dynamic` making it redundant today is not a licence to delete it).
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
