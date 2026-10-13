import { useQuery } from '@tanstack/react-query';
import { SessionEnded } from '~/realm/components/shared/session-ended';
import { REALM_READ } from '~/realm/tools/realm-read';
import { legalControllerQuery } from '../../../queries/legal-controller';
import { readLegalControllerOutcome } from '../../../tools/legal-controller-read';
import { LegalControllerBoard } from '../board/legal-controller-board';
import { LegalControllerForbidden } from '../states/legal-controller-forbidden';
import { LegalControllerLoading } from '../states/legal-controller-loading';
import { LegalControllerUnavailable } from '../states/legal-controller-unavailable';

/**
 * A-21's record region (task 75). **The section reads and picks the arm**: the record, §5.2's permission state for a
 * Billing Operator, a sign-in for a session that ended, or a retry.
 */
export function LegalControllerSection() {
  const query = useQuery(legalControllerQuery());

  if (query.data === undefined) {
    return query.isError ? (
      <LegalControllerUnavailable onRetry={() => void query.refetch()} />
    ) : (
      <LegalControllerLoading />
    );
  }

  const read = readLegalControllerOutcome(query.data);
  switch (read.kind) {
    case REALM_READ.SIGNED_OUT:
      return <SessionEnded />;
    case REALM_READ.FORBIDDEN:
      return <LegalControllerForbidden />;
    case REALM_READ.UNAVAILABLE:
      return <LegalControllerUnavailable onRetry={() => void query.refetch()} />;
    case REALM_READ.READY:
      return <LegalControllerBoard record={read.record} />;
  }
}
