import 'server-only';
import type { AccountMembership } from '@easyesg/contracts';
import { API_OUTCOME } from '@/lib/api-outcome';
import { sanitizeReturnPath } from '@/lib/locale-path';
import { postSignInTarget, type PostSignInTarget } from '@/features/identity/post-sign-in';
import { api } from './api-client';

/**
 * The server seam for §4.3's branch: read the caller's memberships, then decide (task 25.4).
 *
 * One place does both, so the password and provider flows exit identically — a provider session is
 * the same session (UC-05), and task 24 recorded its `?return=`-or-`/home` landing as an interim
 * naming this task as its owner.
 *
 * The access token comes from the sealed cookie the caller has just written; `api-client` attaches
 * it as ambient context the way it attaches the locale, so nothing is threaded through here.
 *
 * **A failure is `null`, not an empty list.** `[]` means the account genuinely belongs to nothing
 * and belongs on S-04; `null` means we could not find out, and belongs on S-35. `api-client`'s
 * `unreachable` outcome — a timeout, a gateway failure, the API down — lands in the same arm as a
 * problem document, because to the person waiting they are one fact with one remedy.
 */
export const resolvePostSignIn = async (returnTo?: string): Promise<PostSignInTarget> => {
  const outcome = await api.getList<AccountMembership>('/memberships');
  return postSignInTarget({
    memberships: outcome.status === API_OUTCOME.Ok ? outcome.value.items : null,
    returnTo: sanitizeReturnPath(returnTo),
  });
};
