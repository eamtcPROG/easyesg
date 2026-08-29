import 'server-only';
import type { CountryLegalForms, Organization } from '@easyesg/contracts';
import { API_OUTCOME } from '@/lib/api-outcome';
import { api } from '../api-client';
import { TENANT_READ, isPermissionRefusal } from './tenant-read';

/**
 * S-15's read — the profile and the vocabulary its two selects are built from (task 30.3).
 *
 * `organization-access.ts`'s split, applied again: this file knows the two routes and what their
 * failures mean, and nothing else.
 *
 * **Two routes in one read, because the screen cannot render either alone.** `GET /organization`
 * answers keys — `legalForm` is `srl`, `countryCode` is `MD` — and a key on a screen is an internal
 * identifier, which CLAUDE.md's user-facing-text rule forbids in terms. `GET /organizations/
 * legal-forms` is what turns them into a *set to choose from*; the wording is the catalogue's
 * (OQ-43). Fetched in parallel: neither feeds the other.
 *
 * **The vocabulary read is not allowed to fail the screen.** It is `@RequiresAccount` rather than
 * `@RequiresRole`, so it cannot be the refusal, and an empty list renders selects with no options —
 * visible, and honest about a country list the platform did not confirm. The profile read is the
 * one whose refusal decides which state S-15 draws.
 */
export type OrganizationProfileRead =
  | {
      readonly status: typeof TENANT_READ.READY;
      readonly organization: Organization;
      /** One entry per country the platform operates in, each with its own legal-form keys. */
      readonly countries: readonly CountryLegalForms[];
    }
  | { readonly status: typeof TENANT_READ.FORBIDDEN }
  | { readonly status: typeof TENANT_READ.UNREACHABLE };

export async function readOrganizationProfile(): Promise<OrganizationProfileRead> {
  const [profile, vocabulary] = await Promise.all([
    api.get<Organization>('/organization'),
    api.getList<CountryLegalForms>('/organizations/legal-forms'),
  ]);

  if (isPermissionRefusal(profile)) return { status: TENANT_READ.FORBIDDEN };
  if (profile.status !== API_OUTCOME.Ok) return { status: TENANT_READ.UNREACHABLE };

  return {
    status: TENANT_READ.READY,
    organization: profile.value,
    countries: vocabulary.status === API_OUTCOME.Ok ? vocabulary.value.items : [],
  };
}
