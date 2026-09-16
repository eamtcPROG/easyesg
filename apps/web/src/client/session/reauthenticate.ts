import {
  readReauthenticationAnswer,
  type ReauthenticationAnswer,
} from '@/features/identity/reauthenticate/tools/reauthentication-answer';
import type {
  FactorCommand,
  PasswordCommand,
} from '@/features/identity/reauthenticate/tools/reauthentication-command';
import { API_OUTCOME } from '@/lib/api-outcome';
import { SESSION_TIER_PATH } from './session-paths';

/**
 * The re-authentication dialogue's two submissions (task 92; UC-07, UX-38), posted to the web tier's own
 * handlers.
 *
 * **Not Server Actions, and the reason is measured** (`architecture.md` §12.5.6's task-92 row): Next marks
 * any Server Action that sets or deletes a cookie as revalidated and re-renders the page, and a factor
 * account's password stage holds its challenge in a cookie while no session exists — so an action would
 * re-render S-07 without a session and unmount the very screen the dialogue is preserving. A Route Handler
 * writes the same cookies and leaves the tree alone.
 *
 * **The body is read back, never cast** — `readReauthenticationAnswer` owns what an answer is, and a
 * request that never reached the tier is `unreachable`, the outcome whose sentence says to try again.
 * `same-origin` credentials carry the cookies; the handlers prove the origin, as the pass-through does.
 */
const JSON_MEDIA_TYPE = 'application/json';

async function post(input: {
  readonly path: string;
  readonly command: PasswordCommand | FactorCommand;
  readonly fetch?: typeof fetch;
}): Promise<ReauthenticationAnswer> {
  const send = input.fetch ?? fetch;
  let response: Response;
  try {
    response = await send(input.path, {
      method: 'POST',
      headers: { 'content-type': JSON_MEDIA_TYPE, accept: JSON_MEDIA_TYPE },
      body: JSON.stringify(input.command),
      credentials: 'same-origin',
      cache: 'no-store',
    });
  } catch {
    return { status: API_OUTCOME.Unreachable };
  }
  const body: unknown = await response.json().catch(() => null);
  return readReauthenticationAnswer({ ok: response.ok, httpStatus: response.status, body });
}

/** The account's password, for the account the screen was rendered for. */
export const submitPassword = (input: {
  readonly command: PasswordCommand;
  readonly fetch?: typeof fetch;
}): Promise<ReauthenticationAnswer> =>
  post({ path: SESSION_TIER_PATH.PASSWORD, command: input.command, fetch: input.fetch });

/** The second factor's code, against the challenge the password stage left sealed in a cookie. */
export const submitFactor = (input: {
  readonly command: FactorCommand;
  readonly fetch?: typeof fetch;
}): Promise<ReauthenticationAnswer> =>
  post({ path: SESSION_TIER_PATH.FACTOR, command: input.command, fetch: input.fetch });
