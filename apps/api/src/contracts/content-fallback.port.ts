import type { FallbackReport, FallbackReporter } from '@easyesg/i18n';

/**
 * FR-64's runtime queue, as its two callers see it (task 76; UC-14, UC-74; `architecture.md` §12.5.6's task-76 row (4),
 * (5)). `platform/localization` keeps it (§6.6); `platform/content` reports into it and says what has been translated.
 * Two faces of one queue rather than one, because the read path reports and never settles, and a consumer must not
 * depend on an operation it never calls.
 *
 * **The key is an item's content key** (`<kind>/<key>`) and the locale the one the reader asked for (182/38: one row
 * per key and locale) — the queue knows nothing of what a key names.
 */

/** A gap a reader met: the item's content key and the locale that had no text. Returns at once; never throws. */
export const CONTENT_FALLBACK_REPORTER = Symbol('CONTENT_FALLBACK_REPORTER');
export type ContentFallbackReporter = FallbackReporter;

/** The queue's other face: every pair that now has a published translation, so its row leaves the queue. */
export interface ContentFallbackSettlement {
  /**
   * Writes what the queue has gathered, **then** removes the pairs named — in that order, so a gap gathered from a
   * cache that predates the publication cannot be written back after it.
   */
  settle(input: { readonly translated: readonly FallbackReport[] }): Promise<void>;
}

export const CONTENT_FALLBACK_SETTLEMENT = Symbol('CONTENT_FALLBACK_SETTLEMENT');
