import type { OverridingPerson } from '@api/modules/core/disclosure/models/disclosure-value.model';
import { displayName } from '@api/modules/identity/account/domain/display-name';

/**
 * The person who replaced a computed figure, read beside it (task 39.4; §12.5.6's task-39 row (3)) — shared by the two
 * tables an override lives on, `core.report_disclosure_value.overridden_by` and `core.calc_source.override_by` (and the
 * run's copy in `core.calc_input`), so a B3 scope and an invoice line name their person by one rule.
 *
 * **A `LEFT JOIN` on `identity.account`, which reads no wider than the figure** — `organization-store.repository.ts`'s
 * argument for the trail: the stored column carries no foreign key, so an erased account yields no row and the figure
 * still reads, named by no one; and the only accounts reachable through it are ones that overrode a figure this
 * organization's row-level security already shows.
 *
 * **The name is UX-137's `displayName`, derived here and never stored**, so a rename reads as the new name. The access
 * store derives it in SQL because it sorts by it; nothing sorts by an overrider, so this calls the function every other
 * surface does.
 */
export interface OverridingPersonRow {
  /** The stored account id — `overridden_by` or `override_by` — selected as `overrider_id`. */
  overrider_id: string | null;
  /** Whether the join found the account — `false` once it is erased. */
  overrider_found: boolean;
  overrider_email: string | null;
  overrider_given_name: string | null;
  overrider_family_name: string | null;
}

/** The join, for a figure's row aliased `figure` whose stored person is `column`. */
export const overridingPersonJoin = (column: string): string =>
  `LEFT JOIN identity.account overrider ON overrider.id = figure.${column}`;

/** The columns the join contributes, named to match `OverridingPersonRow`. */
export const overridingPersonColumns = (column: string): string =>
  `figure.${column} AS overrider_id, overrider.id IS NOT NULL AS overrider_found,
   overrider.email AS overrider_email, overrider.given_name AS overrider_given_name,
   overrider.family_name AS overrider_family_name`;

/** No stored person is no attribution; a stored one the join no longer finds is a person with no name. */
export const overridingPerson = (row: OverridingPersonRow): OverridingPerson | null => {
  if (row.overrider_id === null) return null;
  if (!row.overrider_found || row.overrider_email === null) return { accountId: row.overrider_id, name: null };
  return {
    accountId: row.overrider_id,
    name: displayName({ givenName: row.overrider_given_name, familyName: row.overrider_family_name }, row.overrider_email),
  };
};
