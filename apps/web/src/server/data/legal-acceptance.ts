import 'server-only';
import type { LegalAcceptance } from '@easyesg/contracts';
import type { ApiOutcome } from '@/lib/api-outcome';
import { api } from '../api/api-client';

/**
 * S-43's read — what the signed-in account owes an acceptance of (task 195): each document whose latest acceptance is
 * absent or names another version, at the version in force, beside the one last accepted.
 *
 * **Not `cache()`d**, for `account-setup.ts`'s reason: one reader, once per render, and a memoized answer is exactly the
 * stale one right after the acceptance changed it. The outcome is returned whole, because S-43 draws the api's own
 * sentence where there is one. **Never refused for what it reads**: it is one of the two routes the api admits an
 * account owing an acceptance to, so the api client's redirect to S-43 cannot fire from S-43.
 */
export const readLegalAcceptance = (): Promise<ApiOutcome<LegalAcceptance>> =>
  api.get<LegalAcceptance>('/account/legal-acceptance');
