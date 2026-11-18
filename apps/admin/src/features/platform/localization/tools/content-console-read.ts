import { API_OUTCOME, type ApiOutcome, type ContentConsole } from '@easyesg/contracts';
import { REALM_READ, realmReadFailureOf, type RealmReadFailure } from '~/realm/tools/realm-read';

/** A-03's read, as the arm its section draws (task 67.5). */
export type ContentConsoleRead =
  | { readonly kind: typeof REALM_READ.READY; readonly console: ContentConsole }
  | RealmReadFailure;

export const readContentConsoleOutcome = (outcome: ApiOutcome<ContentConsole>): ContentConsoleRead =>
  outcome.status === API_OUTCOME.Ok ? { kind: REALM_READ.READY, console: outcome.value } : realmReadFailureOf(outcome);
