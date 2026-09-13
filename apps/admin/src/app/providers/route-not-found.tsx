import { useTranslations } from 'use-intl';

/**
 * The router's not-found component — the answer for an address that matches no route.
 *
 * **It exists because a library default is user-facing text nobody here wrote.** Left unset,
 * TanStack Router renders its own hardcoded English "Not Found" — in a Romanian-only console
 * (architecture.md OQ-42), and in a form the ESLint JSXText ban structurally cannot catch,
 * because the literal lives in `node_modules`. The same applies to any dependency shipping
 * default copy; the fix is always to set the option, not to accept the default. `route-error.tsx`
 * is the same reason for the router's other default, split into its own file in task 135.
 *
 * NFR-79's three parts — what failed, what it means, what resolves it; the "what now" is the link
 * back to the console home, which `index.tsx` resolves.
 *
 * Deliberately unstyled beyond layout: inventing a control here is how a second design system
 * starts (UX-127).
 */
export function RouteNotFound() {
  const t = useTranslations('chrome.notFound');

  return (
    <main>
      <h1>{t('title')}</h1>
      <p>{t('body')}</p>
      <a href="/">{t('action')}</a>
    </main>
  );
}
