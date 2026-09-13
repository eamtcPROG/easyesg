import type { ErrorComponentProps } from '@tanstack/react-router';
import { useTranslations } from 'use-intl';

/**
 * The router's error component — the answer when a route throws while rendering.
 *
 * Set for `route-not-found.tsx`'s reason: the router's default is English text nobody here wrote.
 * NFR-79's three parts, with a retry as the "what now".
 *
 * **`reset` retries the failed render rather than reloading the document**, so an operator part-way
 * through a queue does not lose their place. The error itself is never shown: it is a provider or
 * framework string, and the root `CLAUDE.md` forbids one reaching a screen.
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
