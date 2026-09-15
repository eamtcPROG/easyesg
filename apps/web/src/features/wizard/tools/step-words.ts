import type { DisclosureField } from '@easyesg/contracts';

/**
 * What the step's section words on the server before the fields see them — pure, so it is a unit spec
 * (task 134's parent-close review; it lived inline in the route until then).
 *
 * **Keys to words on the server, where the catalogue object can be indexed.** The country domain — ISO
 * 3166, which EFRAG references and does not ship, so the api serves its members unnamed and says so
 * (task 91.1) — is worded from this app's own `countries` catalogue, the same one S-04 reads. A
 * translator call cannot take a code the API supplies (S-13's page records the same reason for legal
 * forms), which is why this indexes the catalogue object rather than calling `t`.
 *
 * **The marker labels left this file with task 158.** They are keyed by `DISCLOSURE_STATE`, a
 * vocabulary known when the code is written rather than a value the API supplies, so `StepField` reads
 * them through `useTranslations` with literal keys — and a missing word is a type error there, where
 * here it was an empty string.
 */

/** An option the api served unnamed but coded is worded from the catalogue; a named one is left alone. */
export const labelledOptions = (
  fields: readonly DisclosureField[],
  countries: Readonly<Record<string, string>>,
): DisclosureField[] =>
  fields.map((field) =>
    field.options === null
      ? field
      : {
          ...field,
          options: field.options.map((option) =>
            option.label !== null || option.code === null
              ? option
              : { ...option, label: countries[option.code] ?? option.code },
          ),
        },
  );
