import type { ApiFailure } from '@easyesg/contracts';
import { Navigate, useLocation } from '@tanstack/react-router';
import { GRANT_READ, grantReadFailureOf } from '../../../tools/support-access-read';
import { SupportAccessForbidden } from '../../shared/support-access-forbidden';
import { SupportAccessUnavailable } from '../../shared/support-access-unavailable';
import { GrantEnded } from '../states/grant-ended';

/**
 * A read under a grant that did not answer (task 67.9), as the arm it means — shared by the reports, the modules and
 * the step, which is its admission. **A closed grant is the one arm the realm's reads lack**: the countdown may have
 * read a minute left when the operator clicked, and the api ended the grant at its own instant.
 */
export function GrantFailure({
  failure,
  onRetry,
  onClose,
}: {
  readonly failure: ApiFailure;
  readonly onRetry: () => void;
  readonly onClose: () => void;
}) {
  const href = useLocation({ select: (location) => location.href });
  const read = grantReadFailureOf(failure);

  switch (read.kind) {
    case GRANT_READ.ENDED:
      return <GrantEnded onClose={onClose} />;
    case GRANT_READ.SIGNED_OUT:
      return <Navigate to="/sign-in" search={{ redirect: href }} />;
    case GRANT_READ.FORBIDDEN:
      return <SupportAccessForbidden />;
    case GRANT_READ.UNAVAILABLE:
      return <SupportAccessUnavailable onRetry={onRetry} />;
  }
}
