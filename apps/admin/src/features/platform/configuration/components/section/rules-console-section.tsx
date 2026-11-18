import { useQuery } from '@tanstack/react-query';
import { API_OUTCOME } from '@easyesg/contracts';
import { SessionEnded } from '~/realm/components/shared/session-ended';
import { REALM_READ, realmReadFailureOf } from '~/realm/tools/realm-read';
import { rulesConsoleQuery } from '../../queries/rules-console';
import { RulesBoard } from '../board/rules-board';
import { RulesForbidden } from '../states/rules-forbidden';
import { RulesLoading } from '../states/rules-loading';
import { RulesUnavailable } from '../states/rules-unavailable';

/**
 * A-05 — factor sets, thresholds, validation rules (task 67.8; UC-80 … UC-82; `design_spec.md` §5.2 A-05). **The
 * section reads and picks the arm**: the board, the permission state, a sign-in for an ended session, or a retry.
 */
export function RulesConsoleSection() {
  const query = useQuery(rulesConsoleQuery());
  if (query.data === undefined) {
    return query.isError ? <RulesUnavailable onRetry={() => void query.refetch()} /> : <RulesLoading />;
  }
  if (query.data.status === API_OUTCOME.Ok) return <RulesBoard slots={query.data.value.slots} />;
  switch (realmReadFailureOf(query.data).kind) {
    case REALM_READ.SIGNED_OUT:
      return <SessionEnded />;
    case REALM_READ.FORBIDDEN:
      return <RulesForbidden />;
    default:
      return <RulesUnavailable onRetry={() => void query.refetch()} />;
  }
}
