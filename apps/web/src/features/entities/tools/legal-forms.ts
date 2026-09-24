import type { CountryLegalForms } from '@easyesg/contracts';

/** A legal form as the select offers it: the value the API stores, and the words the reader sees. */
export interface LegalFormOption {
  readonly value: string;
  readonly label: string;
}

/**
 * The legal forms S-13 offers, in both its modes (task 168): **the organization's country's, and no other's**.
 *
 * The vocabulary is scoped by the organization's country (`architecture.md` §7.2) — the same country the API admits
 * activity codes against — so the select offers exactly that country's forms. **A country this vocabulary does not
 * carry, or none known, offers none** rather than falling back to whichever country is first: a wrong country's forms
 * would let a reader pick one the API then refuses, where an empty select says the list could not be had. The record
 * mode compared the country code with the entity's legal form until this task, and so always offered the first
 * country's — right only while one country is configured.
 *
 * `labels` is the catalogue's `organization.legalForms` object; a form registered ahead of its wording shows its key,
 * which next-intl makes visible rather than silent — the trade the country list takes.
 */
export const legalFormOptions = (input: {
  readonly vocabulary: readonly CountryLegalForms[];
  readonly countryCode: string | null;
  readonly labels: Readonly<Record<string, string>>;
}): readonly LegalFormOption[] => {
  if (input.countryCode === null) return [];
  const forms = input.vocabulary.find((entry) => entry.countryCode === input.countryCode)?.legalForms ?? [];
  return forms.map((form) => ({ value: form, label: input.labels[form] ?? form }));
};
