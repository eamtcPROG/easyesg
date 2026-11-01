import { acceptanceOfEvery, documentsOwed, owesLegalAcceptance, presentsVersionsInForce } from './legal-acceptance';

const IN_FORCE = { terms: '2.0', privacy: '1.1' };

describe('what an account owes an acceptance of (task 195)', () => {
  it('owes nothing once it has accepted the versions in force', () => {
    const accepted = { terms: '2.0', privacy: '1.1' };
    expect(documentsOwed({ accepted, inForce: IN_FORCE })).toEqual([]);
    expect(owesLegalAcceptance({ accepted, inForce: IN_FORCE })).toBe(false);
  });

  it('owes both, with nothing accepted, where it never accepted either — a provider sign-up, an older account', () => {
    expect(documentsOwed({ accepted: {}, inForce: IN_FORCE })).toEqual([
      { document: 'terms', version: '2.0', acceptedVersion: null },
      { document: 'privacy', version: '1.1', acceptedVersion: null },
    ]);
  });

  it('owes only the document a release moved, naming the version it had accepted', () => {
    const accepted = { terms: '1.0', privacy: '1.1' };
    expect(documentsOwed({ accepted, inForce: IN_FORCE })).toEqual([
      { document: 'terms', version: '2.0', acceptedVersion: '1.0' },
    ]);
    expect(owesLegalAcceptance({ accepted, inForce: IN_FORCE })).toBe(true);
  });

  // Not "newer than": a release that went back to an earlier text has still replaced the one accepted.
  it('owes a document whose accepted version is any other, not only an older one', () => {
    expect(owesLegalAcceptance({ accepted: { terms: '3.0', privacy: '1.1' }, inForce: IN_FORCE })).toBe(true);
  });
});

describe('a page presenting the versions in force (task 195)', () => {
  it('admits exactly the versions in force', () => {
    expect(presentsVersionsInForce({ presented: { terms: '2.0', privacy: '1.1' }, inForce: IN_FORCE })).toBe(true);
  });

  it('refuses a page read before a release moved either document', () => {
    expect(presentsVersionsInForce({ presented: { terms: '1.0', privacy: '1.1' }, inForce: IN_FORCE })).toBe(false);
    expect(presentsVersionsInForce({ presented: { terms: '2.0', privacy: '1.0' }, inForce: IN_FORCE })).toBe(false);
  });
});

describe('a registration’s acceptance', () => {
  it('records every accepted document at the version presented', () => {
    expect(acceptanceOfEvery({ terms: '2.0', privacy: '1.1' })).toEqual([
      { document: 'terms', version: '2.0' },
      { document: 'privacy', version: '1.1' },
    ]);
  });
});
