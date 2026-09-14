import { useQuery } from '@tanstack/react-query';
import { API_OUTCOME } from '@easyesg/contracts';
import { adminInvitationPreviewQuery } from '../../queries/invitation';
import { InvitationLoading } from './invitation-loading';
import { InvitationRefused } from './invitation-refused';
import { InvitationSteps } from './invitation-steps';

/**
 * A-20 — accepting an administrator invitation (task 67.4; UC-87; `design_spec.md` §5.2 A-20). **The
 * section reads the link and picks the arm** (`section-reads-parts-render`): still reading, a link that
 * cannot become an account, or the two steps that make one.
 *
 * The client answers with outcomes rather than throwing, so a query that has not settled is loading
 * and nothing else.
 */
export function InvitationScreen({
  token,
  onAccepted,
}: {
  readonly token: string;
  readonly onAccepted: () => void;
}) {
  const preview = useQuery(adminInvitationPreviewQuery(token));

  if (preview.data === undefined) return <InvitationLoading />;
  if (preview.data.status !== API_OUTCOME.Ok) return <InvitationRefused failure={preview.data} />;

  return <InvitationSteps token={token} preview={preview.data.value} onAccepted={onAccepted} />;
}
