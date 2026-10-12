import type { Locale } from '@easyesg/i18n';

/**
 * What the fields a reporting entity's record answers are called, in a language (task 210; `architecture.md` §12.5.6's
 * task-210 row (e)) — by field key, so a finding on one is named beside its message as a disclosure field is named by
 * its label, and a notice's field list names it as it names a disclosure.
 *
 * **In `contracts/` for the reason `disclosure-label.port.ts` is**: `platform/localization` owns the words, and its
 * readers are elsewhere — S-08's and S-11's naming in `core/validation`, a notice's field list in
 * `platform/notification`. **The api's own words**, since no taxonomy labels a field it does not hold.
 */
export interface EntityFieldNames {
  /** Each field's name, by its key; a field some locale does not word is left out rather than named by its key. */
  namesIn(query: { readonly locale: Locale }): Readonly<Record<string, string>>;
}

export const ENTITY_FIELD_NAMES = Symbol('ENTITY_FIELD_NAMES');
