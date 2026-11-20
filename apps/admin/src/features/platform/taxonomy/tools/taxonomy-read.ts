import { API_OUTCOME, type ApiOutcome } from '@easyesg/contracts';
import { REALM_READ, realmReadFailureOf, type RealmReadFailure } from '~/realm/tools/realm-read';

/** Any of A-04's reads, as the arm its region draws (tasks 67.6, 67.7) — A-03's shape, over the read's own value. */
export type TaxonomyRead<T> = { readonly kind: typeof REALM_READ.READY; readonly value: T } | RealmReadFailure;

export const readTaxonomyOutcome = <T>(outcome: ApiOutcome<T>): TaxonomyRead<T> =>
  outcome.status === API_OUTCOME.Ok ? { kind: REALM_READ.READY, value: outcome.value } : realmReadFailureOf(outcome);
