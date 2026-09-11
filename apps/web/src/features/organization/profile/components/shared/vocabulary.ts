/**
 * A vocabulary entry as this screen renders it: the key the API stores, and the word the reader
 * sees (OQ-43).
 *
 * **Resolved by the page, not here**, which is forced rather than chosen — S-04's own page records
 * the reasoning at length. The app's `IntlMessages` augmentation narrows a namespace's keys to the
 * ones authored, so `t(countryCode)` cannot take a value the API supplies; casting would assert that
 * configuration only ever holds what this catalogue happens to know, which is the opposite of what
 * AD-4 makes true. The page indexes the catalogue object and falls back to the key, which is OQ-43's
 * stated behaviour for a value registered ahead of its wording.
 *
 * **In `shared/` because the shell takes it as a prop and `identity-section.tsx` renders it** (task
 * 129) — the same admission test the two `shared/` folders on S-05 use. S-04's creation form carries
 * its own declaration of the same shape; merging them would mean a module `profile/` and `creation/`
 * both read, which is a feature-level decision rather than this split's.
 */
export interface VocabularyOption {
  readonly value: string;
  readonly label: string;
}

/** Each country the platform operates in, labelled, with its own labelled legal forms. */
export interface CountryOption extends VocabularyOption {
  readonly legalForms: readonly VocabularyOption[];
}
