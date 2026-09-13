import type ro from '~/messages/ro.json';
import type { formats } from '~/i18n/formats';

/**
 * Typed message keys and formats for the console.
 *
 * The console ships one catalogue (architecture.md OQ-42), so Romanian defines the key space
 * outright and there is no parity gate here to catch a typo from the other direction — which
 * makes this declaration the *only* thing standing between a mistyped key and a blank on screen.
 * UX-97 forbids a visible "missing translation" marker, so the failure is silent by design.
 *
 * `use-intl` is `next-intl`'s core and takes the same `AppConfig` augmentation, which is the
 * point of pinning the two to one version (§12.1): one message syntax, one `Formats` shape,
 * one way to type them.
 */
declare module 'use-intl' {
  interface AppConfig {
    Messages: typeof ro;
    Formats: typeof formats;
    Locale: import('@easyesg/i18n').Locale;
  }
}
