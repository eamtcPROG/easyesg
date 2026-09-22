import { createHash } from 'node:crypto';
import { isUuid } from '@api/contracts/types/uuid';

/**
 * The namespace a notice's name-based id is derived in — fixed, and never to change: a notice's id is how a
 * redelivered job finds it again, so a new namespace would give every earlier issuance a second notice.
 */
const NOTICE_NAMESPACE = Buffer.from('6f1a2c3e8b5d4e7f9a0b1c2d3e4f5a6b', 'hex');

/**
 * The id a notice is recorded under, from the key of the issuance that opened it (tasks 50.1.1, 50.1.4; §12.5.6's
 * task-49.3 row (3), task-50.1 row (14)).
 *
 * **A key that is a UUID is the id** — `raise()`'s outbox keys are, which is row (3)'s *the record adopts the key*.
 * **A key that is not one is named into one**: a notice delivered from its producer's own event carries that store's
 * natural key (`identity.email_verification.requested:<account>:<expiry>`), and the column is a `uuid`. The name
 * is hashed the way RFC 9562's version 5 hashes it — SHA-1 over namespace and name, the version and variant bits
 * set — so the same key always answers the same id, which is what lets a redelivered job find its notice and send
 * nothing twice.
 */
export const noticeIdFor = (issuanceKey: string): string => {
  if (isUuid(issuanceKey)) return issuanceKey.toLowerCase();

  const bytes = createHash('sha1').update(NOTICE_NAMESPACE).update(issuanceKey, 'utf8').digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};
