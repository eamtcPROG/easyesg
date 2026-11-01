import { createHmac, hkdfSync, timingSafeEqual } from 'node:crypto';
import { isNotificationCategoryKey } from '@api/contracts/notification.port';
import { isNotificationChannel } from '@api/modules/platform/notification/models/notification-category.model';
import type {
  UnsubscribeSubject,
  UnsubscribeTokens,
} from '@api/modules/platform/notification/interfaces/unsubscribe-tokens.interface';

/**
 * `UNSUBSCRIBE_TOKENS` as an HMAC-SHA256 over the subject, under a key HKDF-derived from `UNSUBSCRIBE_SIGNING_KEY`
 * (task 52.2.2; §12.5.6's task-52.2 row (4)).
 *
 * **`v1~<subject>~<mac>`**, each part base64url: the subject is the account, the category and the channel as a JSON
 * array — the category key carries dots, so a dotted join would not split back — and the MAC covers the version and
 * the subject together, so neither can be swapped under the other's signature. **The separator is `~`, never `.`**:
 * the token is a path segment of S-38's address, and `apps/web`'s proxy treats any path with a dot in it as a file —
 * it skips the locale routing, and the page answered Next's unlocalised 404 (found by the browser suite, task
 * 52.2.2). `~` is URL-safe and outside base64url's alphabet, so it splits back unambiguously. The version is in the label as well,
 * `SecretCipher`'s reason: a `v2` is a different key from the same code path.
 *
 * **`read` answers `null` for anything it cannot vouch for** — a malformed token, a bad signature, a subject naming a
 * category or channel this release does not know — and never throws, since a token arrives from a link anyone can
 * edit. The MAC is compared in constant time, and the subject is decoded only after it verifies.
 */
export class HmacUnsubscribeTokens implements UnsubscribeTokens {
  private readonly key: Buffer;

  constructor(secret: string | undefined) {
    // At construction — that is, at boot — the pepper's rule: a link signed under a default is indistinguishable from
    // one signed under a real key until the day someone forges one.
    if (!secret || secret.length < MINIMUM_SECRET_LENGTH) {
      throw new Error(
        `UNSUBSCRIBE_SIGNING_KEY must be set to at least ${MINIMUM_SECRET_LENGTH} characters; the one-click unsubscribe cannot be signed or checked without it`,
      );
    }
    this.key = Buffer.from(hkdfSync('sha256', secret, '', `easyesg-unsubscribe-${VERSION}`, KEY_LENGTH_BYTES));
  }

  sign(subject: UnsubscribeSubject): string {
    const body = Buffer.from(JSON.stringify([subject.accountId, subject.categoryKey, subject.channel])).toString(
      'base64url',
    );
    return [VERSION, body, this.mac(body).toString('base64url')].join(SEPARATOR);
  }

  read(token: string): UnsubscribeSubject | null {
    if (token.length > MAXIMUM_TOKEN_LENGTH) return null;
    const parts = token.split(SEPARATOR);
    if (parts.length !== 3 || parts[0] !== VERSION) return null;
    const [, body, presented] = parts;

    const expected = this.mac(body);
    const given = Buffer.from(presented, 'base64url');
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;

    return subjectOf(Buffer.from(body, 'base64url').toString('utf8'));
  }

  private mac(body: string): Buffer {
    return createHmac('sha256', this.key).update(`${VERSION}${SEPARATOR}${body}`).digest();
  }
}

/** The signed subject, narrowed — a verified token from an older release may name a category this one retired. */
const subjectOf = (json: string): UnsubscribeSubject | null => {
  let decoded: unknown;
  try {
    decoded = JSON.parse(json);
  } catch {
    return null;
  }
  if (!Array.isArray(decoded) || decoded.length !== 3) return null;
  const [accountId, categoryKey, channel] = decoded as unknown[];
  if (typeof accountId !== 'string' || !UUID.test(accountId)) return null;
  if (!isNotificationCategoryKey(categoryKey) || !isNotificationChannel(channel)) return null;
  return { accountId, categoryKey, channel };
};

const VERSION = 'v1';
/** Not `.` — see the class's docblock. */
const SEPARATOR = '~';
const KEY_LENGTH_BYTES = 32;
/** The floor `.env.example`'s `openssl rand -base64 32` clears with room to spare. */
const MINIMUM_SECRET_LENGTH = 32;
/** Far above any token this class signs; a longer one is not ours and is not worth decoding. */
const MAXIMUM_TOKEN_LENGTH = 512;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;
