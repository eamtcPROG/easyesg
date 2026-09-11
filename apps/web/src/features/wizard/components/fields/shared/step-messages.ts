/**
 * The catalogue namespaces the fields region reads, declared once because three files read them
 * (task 134): the section reads all three, the classification row two, the field one. In
 * `fields/shared/` on that folder's one admission test, and `as const` so next-intl still
 * type-checks the keys against the catalogue's shape — the property that makes a missing string a
 * compile error here rather than a blank on a screen.
 */
export const FIELD_MESSAGES = 'organization.wizard.field' as const;

export const GROUP_MESSAGES = 'organization.wizard.group' as const;

/** The derivation inputs' own wording — EFRAG words these in the template, not the taxonomy. */
export const INPUT_MESSAGES = 'organization.wizard.derivationInput' as const;
