import type { Locale } from './locales.js';

/**
 * Where messages come from is an adapter's decision, not this port's.
 *
 * **Amended 19 Aug 2026 (architecture.md OQ-43).** This docblock previously read "Messages are
 * NOT bundled with the application", on the reasoning that a committed `.json` would need a
 * release to change and FR-61/NFR-85 forbid that. OQ-43 narrowed FR-61: catalogue text — chrome,
 * VSME labels, validation messages, notification wording — ships in the release, and only the
 * text edited by people who cannot deploy (help-centre articles, plan presentation copy) stays
 * in the configuration store. So both origins are now legitimate, and the port is what keeps
 * them interchangeable.
 *
 * That interchangeability is the whole value. A key can move from a committed catalogue into the
 * store later without touching a single call site — the cheap direction of OQ-43 — because every
 * consumer depends on this interface rather than on an import path.
 */
export interface MessageCatalogue {
  readonly [key: string]: string | MessageCatalogue;
}

export interface MessageLoader {
  /**
   * Resolve the published catalogue for a locale. Implementations are expected to be
   * request-cached — `getRequestConfig` is memoised per request by next-intl, but a loader
   * reached from anywhere else is not.
   */
  load(locale: Locale): Promise<MessageCatalogue>;
}
