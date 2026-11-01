/**
 * A-20 — Accept an administrator invitation · PA, BO · UC-87 · Focus (task 67.4)
 *
 * Where the link in an administrator invitation email lands: the invitee sets a password and confirms a
 * second factor, and the account exists (`design_spec.md` §5.2 A-20). The screen is
 * `realm/components/invitation/`; this route owns only the token from the path and the hand-off to
 * A-01, with a notice and never the address.
 *
 * **A third surface outside the realm guard, and a deliberate one**: its visitor holds no session and
 * cannot — the token is the capability, and the api judges it on every call (§12.5.6's task-67.4 row).
 * The token is a path segment because that is the link the email carries; it is read from the path
 * once and posted in bodies after that, never put into a query string.
 */
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { InvitationScreen } from '~/realm/components/invitation/invitation-screen';
import { SIGN_IN_NOTICE } from '~/realm/tools/sign-in-notice';

export const Route = createFileRoute('/_focus/invitation/$token')({
  component: AdminInvitationRoute,
});

function AdminInvitationRoute() {
  const { token } = Route.useParams();
  const navigate = useNavigate();

  return (
    <InvitationScreen
      token={token}
      onAccepted={() =>
        void navigate({ to: '/sign-in', search: { notice: SIGN_IN_NOTICE.INVITATION_ACCEPTED } })
      }
    />
  );
}
