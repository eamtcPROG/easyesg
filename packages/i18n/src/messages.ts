import type { Locale } from './locales';

/**
 * Messages are NOT bundled with the application.
 *
 * Labels, help text and validation messages are versioned configuration published from the
 * administrative console as a reviewed, reversible set (FR-61, FR-62), reaching production
 * within one working day of approval and revertible in a single step (NFR-85). A `.json` file
 * committed to this repo would need a release to change, which is that requirement inverted.
 *
 * next-intl is agnostic about where messages come from, so `apps/web`'s `getRequestConfig`
 * calls a loader satisfying this port. The port is the seam; the adapter lives in `apps/web`
 * because it is the thing that holds the API client.
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
