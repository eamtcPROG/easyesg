import { API_OUTCOME, type AdminCredentials, type ApiOutcome } from '@easyesg/contracts';
import { REALM_READ, realmReadFailureOf, type RealmReadFailure } from './realm-read';

/**
 * A-19's read, as the arm its recovery-code region draws (task 151). **Only that region reads** —
 * the password and the second factor need nothing read, since every operator holds both — so a
 * failure here is the screen's *partial* state rather than its error.
 */
export type CredentialsRead =
  | { readonly kind: typeof REALM_READ.READY; readonly credentials: AdminCredentials }
  | RealmReadFailure;

export const readCredentialsOutcome = (outcome: ApiOutcome<AdminCredentials>): CredentialsRead =>
  outcome.status === API_OUTCOME.Ok
    ? { kind: REALM_READ.READY, credentials: outcome.value }
    : realmReadFailureOf(outcome);
