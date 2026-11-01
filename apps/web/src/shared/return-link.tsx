import { TextLink } from '@easyesg/ui';
import { Link } from '@/i18n/navigation';
import { RETURN_DESTINATION, returnDestination } from './return-destination';

/**
 * The way back from *not yet available*, asked of the session on the server (task 103) — the workspace's home for a
 * reader who holds a session, sign-in for one who does not.
 *
 * **Server-side, unlike the 404's** (`probed-return-link.tsx`): this renders only on the page that answers *not yet
 * available*, never as a boundary every page renders, so its cookie read makes dynamic only a page that is dynamic
 * anyway — and the reader gets the right link in the first paint.
 */
export async function ReturnLink({
  actionHome,
  actionSignIn,
}: {
  readonly actionHome: string;
  readonly actionSignIn: string;
}) {
  const destination = await returnDestination();

  return (
    <TextLink asChild>
      <Link href={destination.href}>
        {destination.kind === RETURN_DESTINATION.HOME ? actionHome : actionSignIn}
      </Link>
    </TextLink>
  );
}
