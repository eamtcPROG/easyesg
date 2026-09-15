/**
 * The catalogue namespaces the fields region reads, declared once because more than one of its files
 * reads each (task 134): the section, the classification row and the field — and, since task 158 had
 * them read their own words rather than take them as props, the disclosure control, the choice set, the
 * member picker and the not-available declaration. In `fields/shared/` on that folder's one admission
 * test, and `as const` so next-intl still type-checks the keys against the catalogue's shape — the
 * property that makes a missing string a compile error here rather than a blank on a screen.
 */
export const FIELD_MESSAGES = 'organization.wizard.field' as const;

export const GROUP_MESSAGES = 'organization.wizard.group' as const;

/** The derivation inputs' own wording — EFRAG words these in the template, not the taxonomy. */
export const INPUT_MESSAGES = 'organization.wizard.derivationInput' as const;
