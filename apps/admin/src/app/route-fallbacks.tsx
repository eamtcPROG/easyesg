import type { ErrorComponentProps } from '@tanstack/react-router';
import { useTranslations } from 'use-intl';

/**
 * The router's two default components.
 *
 * **These exist because a library default is user-facing text nobody here wrote.** Left unset,
 * TanStack Router renders its own hardcoded English "Not Found" — in a Romanian-only console
 * (architecture.md OQ-42), and in a form the ESLint JSXText ban structurally cannot catch,
 * because the literal lives in `node_modules`. The same applies to any dependency shipping
 * default copy; the fix is always to set the option, not to accept the default.
 *
 * Both carry NFR-79's three parts — what failed, what it means, what resolves it. The "what
 * now" slot is required, which is why each renders an action and not just a sentence.
 *
 * Deliberately unstyled beyond layout: `packages/ui` exports the token cascade and no
 * components yet, and inventing a button here is how a second design system starts (UX-127).
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

/**
 * `reset` retries the failed render rather than reloading the document, so an operator part-way
 * through a queue does not lose their place. The error itself is never shown: it is a provider
 * or framework string, and CLAUDE.md forbids one reaching a screen.
 */
export function RouteError({ reset }: ErrorComponentProps) {
  const t = useTranslations('chrome.error');

  return (
    <main>
      <h1>{t('title')}</h1>
      <p>{t('body')}</p>
      <button type="button" onClick={reset}>
        {t('action')}
      </button>
    </main>
  );
}
