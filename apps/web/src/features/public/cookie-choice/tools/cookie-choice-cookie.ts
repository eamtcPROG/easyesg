import { COOKIE_CHOICE_KEPT_MONTHS, COOKIE_POLICY_VERSION_IN_FORCE } from '@easyesg/i18n';
import { COOKIE_CHOICE_COOKIE } from '@/lib/session-cookie';

/**
 * The cookie banner's answer as the browser keeps it (task 223; `architecture.md` §12.5.6's task-223 row (2), (8)) — what
 * the Server Action writes into `easyesg_cookie_choice` and the island reads back from `document.cookie` after
 * hydration. **One codec for both sides of the boundary**, so the value the server writes is the value the browser
 * parses; pure, so it is `tools/`'s.
 */
export interface CookieChoiceRecord {
  /** The server record's id. */
  readonly id: string;
  /** The cookie policy version the reader was shown. */
  readonly policyVersion: string;
  /** When they answered, in Unix epoch milliseconds. */
  readonly chosenAt: number;
}

/** Never in a uuid, a version or a number — and left as it is by `encodeURIComponent`. */
const SEPARATOR = '~';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

export const encodeCookieChoice = (record: CookieChoiceRecord): string =>
  [record.id, record.policyVersion, String(record.chosenAt)].join(SEPARATOR);

/** The record a value holds, or null for anything else — a cookie is input the browser can change. */
export function decodeCookieChoice(value: string | undefined): CookieChoiceRecord | null {
  if (!value) return null;
  const parts = value.split(SEPARATOR);
  if (parts.length !== 3) return null;
  const [id, policyVersion, at] = parts;
  const chosenAt = Number(at);
  if (!UUID.test(id) || policyVersion === '' || !Number.isSafeInteger(chosenAt) || chosenAt <= 0) return null;
  return { id, policyVersion, chosenAt };
}

/**
 * The cookie's raw value in a `document.cookie` string, or `''` where there is none — a primitive, so a snapshot read
 * twice with nothing changed compares equal.
 */
export function cookieChoiceValueIn(documentCookie: string): string {
  for (const pair of documentCookie.split(';')) {
    const at = pair.indexOf('=');
    if (at !== -1 && pair.slice(0, at).trim() === COOKIE_CHOICE_COOKIE) {
      try {
        return decodeURIComponent(pair.slice(at + 1).trim());
      } catch {
        return '';
      }
    }
  }
  return '';
}

/**
 * When the cookie lapses: `COOKIE_CHOICE_KEPT_MONTHS` calendar months after the answer, in UTC, the day clamped to the
 * month's last — PostgreSQL's `interval` arithmetic, so the cookie and the record it proves end on the same date.
 */
export function cookieChoiceExpires(chosenAt: number): Date {
  const answered = new Date(chosenAt);
  const expires = new Date(chosenAt);
  expires.setUTCDate(1);
  expires.setUTCMonth(answered.getUTCMonth() + COOKIE_CHOICE_KEPT_MONTHS);
  const lastDay = new Date(Date.UTC(expires.getUTCFullYear(), expires.getUTCMonth() + 1, 0)).getUTCDate();
  expires.setUTCDate(Math.min(answered.getUTCDate(), lastDay));
  return expires;
}

/** Whether the browser has answered the cookie policy in force — absent, unreadable or older shows the banner. */
export const answersPolicyInForce = (record: CookieChoiceRecord | null): record is CookieChoiceRecord =>
  record !== null && record.policyVersion === COOKIE_POLICY_VERSION_IN_FORCE;
