import { API_OUTCOME, type ApiOutcome, type LegalControllerRecord } from '@easyesg/contracts';
import { REALM_READ, realmReadFailureOf, type RealmReadFailure } from '~/realm/tools/realm-read';

/** A-21's read, as the arm its section draws (task 75): the record itself when ready. */
export type LegalControllerRead =
  | { readonly kind: typeof REALM_READ.READY; readonly record: LegalControllerRecord }
  | RealmReadFailure;

export const readLegalControllerOutcome = (outcome: ApiOutcome<LegalControllerRecord>): LegalControllerRead =>
  outcome.status === API_OUTCOME.Ok ? { kind: REALM_READ.READY, record: outcome.value } : realmReadFailureOf(outcome);
