import { SkipLink } from '@easyesg/ui';
import { useTranslations } from 'use-intl';

/**
 * UX-99's skip link (task 203.3), the first thing a keyboard reaches on every console page — the realm's and A-01's
 * alike, since the root route wraps both — to the `<main>` each one marks with `MAIN_CONTENT_ID`. It reads its own
 * words, so the root route composes and resolves no string (`shell-composes-only`).
 */
export function ConsoleSkipLink() {
  const t = useTranslations('chrome');
  return <SkipLink label={t('skipLink')} />;
}
