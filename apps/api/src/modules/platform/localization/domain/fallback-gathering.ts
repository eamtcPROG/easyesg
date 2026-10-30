import type { Locale } from '@easyesg/i18n';

/** One row of the queue as gathered between two writes: a content key, a locale, and how many readers met the gap. */
export interface GatheredFallback {
  readonly key: string;
  readonly locale: Locale;
  readonly occurrences: number;
}

/**
 * The gaps readers met since the queue last wrote (task 76; 182/38; `architecture.md` §12.5.6's task-76 row (5)) — one
 * count per content key and locale, so a gap a hundred readers met is one row's count of a hundred, written once.
 * Taken whole: `take` answers what was gathered and starts again, so nothing is written twice.
 */
export class FallbackGathering {
  private gathered = new Map<string, Map<Locale, number>>();

  add(report: { readonly key: string; readonly locale: Locale }): void {
    const locales = this.gathered.get(report.key) ?? new Map<Locale, number>();
    locales.set(report.locale, (locales.get(report.locale) ?? 0) + 1);
    this.gathered.set(report.key, locales);
  }

  take(): GatheredFallback[] {
    const taken = this.gathered;
    this.gathered = new Map();
    return [...taken].flatMap(([key, locales]) =>
      [...locales].map(([locale, occurrences]) => ({ key, locale, occurrences })),
    );
  }
}
