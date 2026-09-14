import { API_OUTCOME, type ApiOutcome, type IdentityProvider, type ListResult } from '@easyesg/contracts';
import { REALM_READ, realmReadFailureOf, type RealmReadFailure } from '~/realm/tools/realm-read';

/**
 * A-18's read, as the arm its section draws (task 67.11). Two providers, read whole — a ready read is the
 * providers themselves, with no page to count.
 */
export type ProvidersRead =
  | { readonly kind: typeof REALM_READ.READY; readonly providers: readonly IdentityProvider[] }
  | RealmReadFailure;

export const readProvidersOutcome = (outcome: ApiOutcome<ListResult<IdentityProvider>>): ProvidersRead =>
  outcome.status === API_OUTCOME.Ok
    ? { kind: REALM_READ.READY, providers: outcome.value.items }
    : realmReadFailureOf(outcome);
