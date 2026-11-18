import { isLocale, SOURCE_LOCALE, type Locale } from '@easyesg/i18n';

/**
 * A-04's addressable state (UX-4; task 67.6): the pair whose mapping and label diff are open, and the diff's locale.
 * Read leniently — a malformed value is no choice, and the screen picks the pair it would show first.
 */
export interface TaxonomySearch {
  readonly from?: string;
  readonly to?: string;
  readonly locale?: Locale;
}

const VERSION = /^\d{4}-\d{2}-\d{2}$/u;

export function readTaxonomySearch(raw: Record<string, unknown>): TaxonomySearch {
  const version = (value: unknown) => (typeof value === 'string' && VERSION.test(value) ? value : undefined);
  const from = version(raw.from);
  const to = version(raw.to);
  const locale = typeof raw.locale === 'string' && isLocale(raw.locale) ? raw.locale : undefined;
  return {
    ...(from === undefined || to === undefined || from >= to ? {} : { from, to }),
    ...(locale === undefined ? {} : { locale }),
  };
}

/** The pair to open: the address's, or the latest two registered versions, or none while fewer than two exist. */
export function openPair(input: {
  readonly search: TaxonomySearch;
  readonly versions: readonly string[];
}): { readonly from: string; readonly to: string } | null {
  if (input.search.from !== undefined && input.search.to !== undefined) return { from: input.search.from, to: input.search.to };
  const sorted = [...input.versions].sort();
  return sorted.length < 2 ? null : { from: sorted[sorted.length - 2], to: sorted[sorted.length - 1] };
}

export const diffLocaleOf = (search: TaxonomySearch): Locale => search.locale ?? SOURCE_LOCALE;
