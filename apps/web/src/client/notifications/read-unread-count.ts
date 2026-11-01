import { readResultObject } from '@easyesg/contracts';

/**
 * `GET /api/v1/notifications/unread-count` through the token-attaching pass-through (task 50.2.1; FR-161, UX-62) —
 * the only path from the browser to the API (AD-9), so nothing here knows a token exists.
 *
 * **It answers the count or `null`, never throws.** A poll that fails is not an error the reader can act on: the
 * badge keeps what it last knew and the poll backs off (`unread-count-state.ts`). An answer this tier cannot read —
 * a missing envelope, a count that is not a whole number — is the same fact as no answer.
 */
const UNREAD_COUNT_PATH = '/api/v1/notifications/unread-count';

export async function readUnreadCount(input: { readonly fetch?: typeof fetch } = {}): Promise<number | null> {
  const send = input.fetch ?? fetch;
  try {
    const response = await send(UNREAD_COUNT_PATH, {
      headers: { accept: 'application/json' },
      credentials: 'same-origin',
      cache: 'no-store',
    });
    if (!response.ok) return null;
    const { object } = readResultObject<{ unread?: unknown }>(await response.json(), UNREAD_COUNT_PATH);
    const unread = object?.unread;
    return typeof unread === 'number' && Number.isSafeInteger(unread) && unread >= 0 ? unread : null;
  } catch {
    return null;
  }
}
