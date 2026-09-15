import 'server-only';
import type { AccountSetup } from '@easyesg/contracts';
import type { ApiOutcome } from '@/lib/api-outcome';
import { api } from '../api/api-client';

/**
 * S-36's read — the account's setup as the API states it (task 155): which step is owed, the name
 * parts to pre-fill, the language to pre-select.
 *
 * **Not `cache()`d, unlike `memberships.ts`.** It has one reader, once per render, and a memoized
 * answer is exactly the stale one right after a step's action has changed it. The outcome is returned
 * whole, because S-36 draws a failure it can name — a lapsed setup answers `authentication-required`
 * — differently from one it cannot.
 */
export const readAccountSetup = (): Promise<ApiOutcome<AccountSetup>> =>
  api.get<AccountSetup>('/account/setup');
