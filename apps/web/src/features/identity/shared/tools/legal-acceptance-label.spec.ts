import { describe, expect, it } from 'vitest';
import ro from '@/messages/ro.json';
import { LEGAL_ACCEPTANCE_LABEL, legalAcceptanceLabel } from './legal-acceptance-label';

describe('the acceptance’s sentence (task 195)', () => {
  it('names both documents where both are accepted, in either order', () => {
    expect(legalAcceptanceLabel(['terms', 'privacy'])).toBe(LEGAL_ACCEPTANCE_LABEL.BOTH);
    expect(legalAcceptanceLabel(['privacy', 'terms'])).toBe(LEGAL_ACCEPTANCE_LABEL.BOTH);
  });

  it('names the one document a release moved alone', () => {
    expect(legalAcceptanceLabel(['terms'])).toBe(LEGAL_ACCEPTANCE_LABEL.TERMS);
    expect(legalAcceptanceLabel(['privacy'])).toBe(LEGAL_ACCEPTANCE_LABEL.PRIVACY);
  });

  // The three are keys of `identity.legalAcceptance`; a renamed leaf would render an empty label, not an error.
  it('answers only keys the catalogue words', () => {
    const labels = ro.identity.legalAcceptance.label as Record<string, string>;
    for (const key of Object.values(LEGAL_ACCEPTANCE_LABEL)) {
      expect(labels[key.replace('label.', '')]).toBeTruthy();
    }
  });
});
