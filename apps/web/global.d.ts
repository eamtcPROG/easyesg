import type ro from '@/messages/ro.json';
import type sharedRo from '@easyesg/i18n/catalogues/ro.json';
import type { formats } from '@/i18n/formats';

/**
 * Typed message keys and formats.
 *
 * Romanian is the source locale (NFR-23), so it defines the key space: `en.json` and `ru.json`
 * are translations of it, never extensions of it. A key that exists only in a translation is a
 * mistake, and deriving the type from `ro.json` is what makes it one — `messages.parity.spec.ts`
 * catches the same drift from the other direction at test time.
 *
 * The point of this file is that `useTranslations('chrome.nope')` fails `pnpm typecheck` rather
 * than rendering nothing. UX-97 forbids a visible "missing translation" marker, so a wrong key
 * is invisible at runtime by design — which is exactly why it has to be caught before runtime.
 */
declare module 'next-intl' {
  interface AppConfig {
    // The `validation` namespace is the shared catalogue's, read beside this app's own (task 42.1;
    // `server/messages/messages.ts` says why).
    Messages: typeof ro & Pick<typeof sharedRo, 'validation'>;
    Formats: typeof formats;
    Locale: import('@easyesg/i18n').Locale;
  }
}
