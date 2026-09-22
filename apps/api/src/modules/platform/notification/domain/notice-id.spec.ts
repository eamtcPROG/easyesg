import { noticeIdFor } from './notice-id';

/** A notice's id from its issuance's key (task 50.1.4). */
describe('noticeIdFor (task 50.1.4)', () => {
  const natural = 'identity.email_verification.requested:0192f000-0000-7000-8000-000000000001:1790726400000';

  it('adopts a key that is already a UUID', () => {
    expect(noticeIdFor('0192F000-0000-7000-8000-00000000000A')).toBe('0192f000-0000-7000-8000-00000000000a');
  });

  it('names a natural key into a version-5 UUID', () => {
    expect(noticeIdFor(natural)).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  // What a redelivered job relies on: the same key, the same notice.
  it('answers the same id for the same key, and another for another', () => {
    expect(noticeIdFor(natural)).toBe(noticeIdFor(natural));
    expect(noticeIdFor(`${natural}1`)).not.toBe(noticeIdFor(natural));
  });

  // Pinned as a literal, so a changed namespace — which would give every earlier issuance a second notice — fails.
  it('keeps its namespace', () => {
    expect(noticeIdFor('a')).toBe('2ced401a-acf8-5e05-888a-df3726dfb84a');
  });
});
