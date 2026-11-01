import { describe, expect, it } from 'vitest';
import { ACTOR_KIND, entryActorOf } from './entry-actor';

const READER = '0192f000-0000-7000-8000-00000000a001';
const OTHER = '0192f000-0000-7000-8000-00000000a002';

/** S-12's person line (task 84.2): the platform, an erased account, or a person — the reader and the removed marked. */
describe('entryActorOf', () => {
  it('reads no actor as the platform’s change', () => {
    expect(entryActorOf({ actor: null, readerAccountId: READER })).toEqual({ kind: ACTOR_KIND.PLATFORM });
  });

  it('keeps an erased account’s change, unnamed, and still marks it removed', () => {
    expect(entryActorOf({ actor: { accountId: OTHER, name: null, removed: true }, readerAccountId: READER })).toEqual({
      kind: ACTOR_KIND.ERASED,
      removed: true,
    });
  });

  it('marks the reader as themself, and a person without access as removed', () => {
    expect(entryActorOf({ actor: { accountId: READER, name: 'Ana Rusu', removed: false }, readerAccountId: READER })).toEqual({
      kind: ACTOR_KIND.PERSON,
      name: 'Ana Rusu',
      you: true,
      removed: false,
    });
    expect(
      entryActorOf({ actor: { accountId: OTHER, name: 'Dorin Mardari', removed: true }, readerAccountId: READER }),
    ).toMatchObject({ you: false, removed: true });
  });
});
