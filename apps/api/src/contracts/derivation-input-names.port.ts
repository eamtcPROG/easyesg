import type { Locale } from '@easyesg/i18n';

/**
 * What the values a computed figure is worked out from are called, in a language (task 254; `architecture.md` §12.5.6's
 * task-254 row (3)) — by field key, `input:<key>`, so a finding on one is named beside its message as a disclosure field
 * is named by its label, and a notice's field list names it as it names a disclosure.
 *
 * **In `contracts/` for the reason `entity-field-names.port.ts` is**: `platform/localization` owns the words, and its
 * readers are elsewhere — S-08's and S-11's naming in `core/validation`, a notice's field list in
 * `platform/notification`. **The words the PDF prints beneath the figure and S-07 labels the box with**
 * (`core.export.document.inputs`), since EFRAG words these in its template and no taxonomy labels them.
 */
export interface DerivationInputNames {
  /** Each input's name, by its field key; an input some locale does not word is left out rather than named by its key. */
  namesIn(query: { readonly locale: Locale }): Readonly<Record<string, string>>;
}

export const DERIVATION_INPUT_NAMES = Symbol('DERIVATION_INPUT_NAMES');
