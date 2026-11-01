import type { ChangeActor } from '@easyesg/contracts';

/** How an entry names who made it (§12.5.6's task-84 row (c)). */
export const ACTOR_KIND = {
  /** No person made it — the platform's change. */
  PLATFORM: 'platform',
  /** A person whose account no longer exists: the change stays, their name does not (FR-55). */
  ERASED: 'erased',
  PERSON: 'person',
} as const;

export type EntryActor =
  | { readonly kind: typeof ACTOR_KIND.PLATFORM }
  | { readonly kind: typeof ACTOR_KIND.ERASED; readonly removed: boolean }
  | { readonly kind: typeof ACTOR_KIND.PERSON; readonly name: string; readonly you: boolean; readonly removed: boolean };

/**
 * Who an entry names, for the reader looking at it: the platform, an account since erased, or a person — **the reader
 * themself marked as such**, and **a person without access marked, never hidden** (UX-69). Pure, so the arms are a
 * spec's rather than a browser journey's.
 */
export function entryActorOf(input: { readonly actor: ChangeActor | null; readonly readerAccountId: string }): EntryActor {
  const { actor } = input;
  if (actor === null) return { kind: ACTOR_KIND.PLATFORM };
  if (actor.name === null) return { kind: ACTOR_KIND.ERASED, removed: actor.removed };
  return { kind: ACTOR_KIND.PERSON, name: actor.name, you: actor.accountId === input.readerAccountId, removed: actor.removed };
}
