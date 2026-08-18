import type { Locale } from './locales';

/**
 * UX-97: where a string falls back to the source locale at runtime, the user sees the fallback
 * **without decoration**, and the gap is logged per key to the translation review queue
 * (FR-64, FR-10). A visible "missing translation" marker is prohibited in the tenant interface.
 *
 * That prohibition is what makes this channel load-bearing rather than a nicety: with no marker
 * on screen, this report is the only evidence the gap exists. PA works the resulting queue in
 * A-03, and NFR-91 alerts on locale-fallback spikes.
 */
export interface FallbackReport {
  readonly key: string;
  readonly locale: Locale;
  readonly namespace?: string;
}

export interface FallbackReporter {
  report(report: FallbackReport): void;
}

/**
 * Discards reports. For unit tests and for the source locale, where a fallback is not a gap.
 */
export const noopFallbackReporter: FallbackReporter = {
  report() {
    /* intentionally empty */
  },
};
