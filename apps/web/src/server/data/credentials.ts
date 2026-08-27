import 'server-only';
import { API_OUTCOME, type ApiOutcome } from '@/lib/api-outcome';
import {
  SECTION_READ,
  type CredentialsRead,
  type LinkedProvider,
  type SectionRead,
  type TotpState,
} from '@/features/credentials/credentials';
import { api } from '../api-client';

/**
 * S-28's read — the seam that fetches, beside the module that says what a credential *is*
 * (task 27.7). The vocabulary and the shapes live in `features/credentials/credentials.ts`,
 * because a Client Component needs them and this file may never reach the browser.
 *
 * `GET /account/totp` and `GET /account/providers` are separate resources with separate owners in
 * the api (`identity/account` and `identity/provider`), and the screen needs both. They are fetched
 * **in parallel** because they are independent — sequential awaits would put a second round trip on
 * a settings screen's critical path for an ordering that does not exist (`async-parallel`).
 *
 * **Each half carries its own outcome.** §8.1's partial state is the reason: the screen decides per
 * section, and one unreachable read does not blank the other two.
 */
const section = <T>(outcome: ApiOutcome<T>): SectionRead<T> =>
  outcome.status === API_OUTCOME.Ok && outcome.value !== null
    ? { status: SECTION_READ.READY, value: outcome.value }
    : { status: SECTION_READ.UNREACHABLE };

export async function readCredentials(): Promise<CredentialsRead> {
  const [factor, providers] = await Promise.all([
    api.get<TotpState>('/account/totp'),
    api.getList<LinkedProvider>('/account/providers'),
  ]);

  return {
    factor: section(factor),
    providers:
      providers.status === API_OUTCOME.Ok && providers.value !== null
        ? { status: SECTION_READ.READY, value: providers.value.items }
        : { status: SECTION_READ.UNREACHABLE },
  };
}
