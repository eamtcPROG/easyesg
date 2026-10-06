import { readCredentials } from '@/server/data/credentials';
import { readPendingLink } from '@/server/sealed/pending-link';
import {
  CREDENTIALS_ARRIVAL_PARAM,
  CREDENTIALS_ONWARD_PARAM,
  readCredentialsArrival,
  readCredentialsOnward,
} from '../../tools/credentials-arrival';
import { CredentialsBoard } from './credentials-board';

/**
 * S-28's one region: the two reads and the board they feed (UC-10 … UC-12, UC-193; cut out of the route by task 137,
 * `shell-composes-only`).
 *
 * **Two reads, fetched in parallel and failing independently** (§8.1's partial state): a provider list that could not
 * be fetched must not hide a working password form. **It can be entered mid-flow** — returning from a provider lands
 * here with a link awaiting its password (§12.5.6's task-27.7 row) — which is why the pending link is read on the
 * server and handed to the board rather than discovered in an effect. **Or after a recovery sign-in** (task 190), whose
 * `?notice=recovered` is read here the same way and announced above the rows.
 */
export async function CredentialsSection({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // In parallel: the two section reads and the pending-link cookie are independent, and a settings screen should not
  // pay a second round trip for an ordering that does not exist. The address is not I/O, so awaiting it costs nothing.
  const [read, pending, query] = await Promise.all([readCredentials(), readPendingLink(), searchParams]);
  return (
    <CredentialsBoard
      read={read}
      pendingLinkProvider={pending?.provider ?? null}
      arrival={readCredentialsArrival(query[CREDENTIALS_ARRIVAL_PARAM])}
      onward={readCredentialsOnward(query[CREDENTIALS_ONWARD_PARAM])}
    />
  );
}
