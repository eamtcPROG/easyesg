import { isEmail } from 'class-validator';

/**
 * Where a support request is delivered (task 77; FR-212; `architecture.md` §12.5.6's task-77 row (5)) — the platform's
 * support mailbox, one address. **A fact, not wording**, so it may be configuration: seeded with `ajutor@easyesg.md` and
 * changed without a deploy, the way the legal controller's facts are.
 */
export interface SupportChannel {
  readonly address: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * A payload read as the channel, trimmed, or `null` — `class-validator`'s `isEmail`, the function the api's DTOs judge
 * an address with, so the address the store admits is one a request DTO would.
 */
export const readSupportChannel = (payload: unknown): SupportChannel | null => {
  if (!isRecord(payload) || typeof payload.address !== 'string') return null;
  const address = payload.address.trim();
  return isEmail(address) ? { address } : null;
};

/** Why the store refuses a payload of this kind, or `null` — asked before it writes, the seed loader included. */
export const supportChannelRefusal = (payload: unknown): string | null =>
  readSupportChannel(payload) === null ? 'a support channel names one email address' : null;
