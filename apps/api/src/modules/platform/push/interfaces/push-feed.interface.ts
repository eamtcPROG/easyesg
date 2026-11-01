import type { PushHint } from '../domain/push-hint';

/**
 * What an api replica hears of the worker's hints (task 148). Started by the gateway with its first socket, and at
 * most once however often it is asked; each hint is handed to `deliver`, which routes it to the sockets it reaches.
 */
export interface PushFeed {
  start(deliver: (hint: PushHint) => void): Promise<void>;
}

export const PUSH_FEED = Symbol('PUSH_FEED');
