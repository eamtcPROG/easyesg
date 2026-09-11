import { DISCLOSURE_STATE, type DisclosureField, type DisclosureState } from '@easyesg/contracts';

/**
 * Two things the step's section resolves on the server before the fields see them — pure, so both
 * are unit specs (task 134's parent-close review; they lived inline in the route until then).
 *
 * **Keys to words on the server, where the catalogue object can be indexed.** A translator call
 * cannot take a value the API supplies (S-13's page records the same reason for legal forms), so
 * the marker labels arrive as a record built from the catalogue, and the country domain — ISO
 * 3166, which EFRAG references and does not ship, so the api serves its members unnamed and says
 * so (task 91.1) — is worded from this app's own `countries` catalogue, the same one S-04 reads.
 */

/** §6.4's label per state; a state the catalogue does not word is `''`, and `ok` carries no marker. */
export const markerLabelsOf = (
  markers: Readonly<Record<string, string>>,
): Readonly<Record<DisclosureState, string>> =>
  Object.fromEntries(
    Object.values(DISCLOSURE_STATE).map((state) => [state, markers[state] ?? '']),
  ) as Record<DisclosureState, string>;

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
