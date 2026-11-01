import type { SupportChannel } from '../domain/support-channel';

export const SUPPORT_CHANNEL_READER = Symbol('SUPPORT_CHANNEL_READER');

/** The support address in force, or `null` where none is readable — which refuses a request (row (5)). */
export interface SupportChannelReader {
  inForce(): SupportChannel | null;
}
