import type { ExportLanguage } from '@easyesg/contracts';
import { LABEL_STANDING, isLocale, toLocale, type Locale } from '@easyesg/i18n';

/**
 * The dialogue's second decision (task 47.2; FR-52, UX-47): the language a file is written in, chosen independently of
 * the interface's.
 *
 * **It starts from the account's export language** (`identity.account.export_locale`, task 52.3), and from the reader's
 * own where the profile could not be read — never a value the screen invents.
 */
export const initialExportLanguage = (input: { readonly exportLocale: Locale | null; readonly reader: string }): Locale =>
  input.exportLocale ?? toLocale(input.reader);

/**
 * Whether the labels in this language are the platform's rather than EFRAG's at the report's pin — the case the
 * dialogue states (UX-47, T-14 as amended), read from the api's answer per language (`architecture.md` §12.5.6's task-47
 * row (k)), so the statement follows the pin rather than naming Romanian and Russian in code. A language the answer
 * does not carry says nothing: an absent standing is not a platform-authored one.
 */
export const carriesNoStanding = (input: {
  readonly languages: readonly ExportLanguage[];
  readonly locale: Locale;
}): boolean =>
  input.languages.find((language) => language.locale === input.locale)?.labelStanding === LABEL_STANDING.PLATFORM_AUTHORED;

/** The language the dialogue recommends for a bank or an EU buyer: the first whose labels are EFRAG's own, or none. */
export const recommendedLanguage = (languages: readonly ExportLanguage[]): Locale | null => {
  const official = languages.find((language) => language.labelStanding === LABEL_STANDING.OFFICIAL)?.locale;
  return official !== undefined && isLocale(official) ? official : null;
};
