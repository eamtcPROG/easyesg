import { getRequestConfig } from 'next-intl/server';
import { hasLocale, IntlErrorCode } from 'next-intl';
import type { Locale } from '@easyesg/i18n';
import { routing } from './routing';
import { formats } from './formats';
import { messageLoader } from '@/server/messages';

/**
 * Per-request i18n configuration. next-intl memoises this with React's `cache`, so the
 * catalogue is fetched once per request no matter how many components ask for it.
 *
 * On `requestLocale` vs `next/root-params`: next-intl 4.13 marks `requestLocale` deprecated in
 * favour of `next/root-params`, which Next 16.3 enables by default. We stay on `requestLocale`
 * deliberately. `next/root-params` throws inside a Route Handler (Next error E1043 — "support
 * for this API in Route Handlers is planned for a future version"), and its module is a
 * compiler-replaced placeholder that throws on plain import, which breaks unit tests that reach
 * this file. Adopting it today would add two failure modes to buy nothing, so the migration
 * waits for Route Handler support. Logged as an open question in architecture.md §18.
 */
export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;

  // `[locale]` behaves as a catch-all for unknown paths (`/unknown.txt`), so an invalid value
  // is expected rather than exceptional and resolves to the source locale.
  const locale: Locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;

  return {
    locale,
    messages: await messageLoader.load(locale),
    formats,

    // NFR-34: a legal date is determined by a timezone, and Moldova's filing calendar is what
    // the reporting period is read against. Instants render here and nowhere else (§6.8).
    // TODO(architecture.md §18): this should follow the organization once entities carry one.
    timeZone: 'Europe/Chisinau',

    onError(error) {
      // A missing message is not an application error — it is a content gap, and the queue in
      // A-03 is where it gets fixed (FR-64). NFR-91 alerts on locale-fallback spikes. Anything
      // else is a real formatting failure and should be loud.
      if (error.code === IntlErrorCode.MISSING_MESSAGE) return;
      console.error(error);
    },

    getMessageFallback() {
      // UX-97 renders a fallback WITHOUT decoration and prohibits a visible "missing
      // translation" marker in the tenant interface. next-intl's default returns the message
      // key — which is an internal identifier, and CLAUDE.md forbids one reaching a screen.
      //
      // Reaching here means the key is absent in every locale, because the server resolves
      // source-locale fallback before responding. That is a defect in the catalogue, and an
      // empty string is the only rendering that neither lies nor leaks.
      return '';
    },
  };
});
