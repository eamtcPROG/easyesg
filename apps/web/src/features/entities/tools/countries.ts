import type { CountryLegalForms } from '@easyesg/contracts';

/**
 * The countries a site may be in — the ones the platform registers, named in the reader's language (task 180.1).
 *
 * **The same set B1's `CountryOfSite` offers**, which is the point: the step read serves the registered countries as
 * that field's domain (`architecture.md` §12.5.6's task-91.1 row), so a country S-13 accepted and B1 could not name
 * would be a site whose country never reaches the report. A code with no wording yet shows as its code, S-04's trade.
 */
export interface CountryOption {
  readonly value: string;
  readonly label: string;
}

export const countryOptions = (input: {
  readonly vocabulary: readonly CountryLegalForms[];
  readonly labels: Readonly<Record<string, string>>;
}): readonly CountryOption[] =>
  input.vocabulary.map((entry) => ({ value: entry.countryCode, label: input.labels[entry.countryCode] ?? entry.countryCode }));

/** The country a new site starts in: the one registered, where there is one, and none otherwise. */
export const defaultCountry = (options: readonly CountryOption[]): string =>
  options.length === 1 ? options[0].value : '';
