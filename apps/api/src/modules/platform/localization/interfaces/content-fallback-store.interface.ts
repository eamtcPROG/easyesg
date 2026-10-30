import type { Locale } from '@easyesg/i18n';
import type { GatheredFallback } from '../domain/fallback-gathering';

export const CONTENT_FALLBACK_STORE = Symbol('CONTENT_FALLBACK_STORE');

/**
 * `config.content_fallback` (task 76; 182/38; `1793491200000-content-fallback.ts`) — one row per content key and
 * locale. The request tier's alone: it writes what readers met and removes what is translated. **The times are the
 * database's**, so every replica's writes are on one clock.
 */
export interface ContentFallbackStore {
  /** Adds each to its row — created with this write's time as first and last seen, or its count and last seen moved. */
  record(input: { readonly gathered: readonly GatheredFallback[] }): Promise<void>;

  /** Removes the rows of the pairs named; a pair with no row is nothing to remove. */
  clear(input: { readonly translated: readonly { readonly key: string; readonly locale: Locale }[] }): Promise<void>;
}
