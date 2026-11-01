import { describe, expect, it } from 'vitest';
import {
  ACCEPTED_LEGAL_DOCUMENTS,
  LEGAL_DOCUMENT,
  LEGAL_STANDING,
  LEGAL_VERSIONS_IN_FORCE,
  isAcceptedLegalDocument,
  isLegalDocument,
} from './legal-standing.js';

/** A version as a person cites it — numbers separated by dots. */
const VERSION_SHAPE = /^\d+(\.\d+)*$/u;
/** A calendar day, never an instant (NFR-34). */
const CALENDAR_DAY = /^\d{4}-\d{2}-\d{2}$/u;

describe('each legal document’s standing (FR-205 AC-4, AC-10; task 75)', () => {
  it('gives every document of the set a version and an effective calendar day in a named zone', () => {
    for (const document of Object.values(LEGAL_DOCUMENT)) {
      const standing = LEGAL_STANDING[document];
      expect(standing.version).toMatch(VERSION_SHAPE);
      expect(standing.effective.date).toMatch(CALENDAR_DAY);
      expect(standing.effective.timezone).toBe('Europe/Chisinau');
    }
  });

  it('names exactly the three documents of the set', () => {
    expect(Object.keys(LEGAL_STANDING).sort()).toEqual(Object.values(LEGAL_DOCUMENT).sort());
  });

  it('narrows a value to the set and nothing else', () => {
    expect(isLegalDocument('terms')).toBe(true);
    expect(isLegalDocument('cookies')).toBe(true);
    expect(isLegalDocument('processing-agreement')).toBe(false);
  });
});

describe('the documents a person accepts (task 195)', () => {
  // The wire values, pinned: `identity.legal_acceptance`'s CHECK holds the same two literally.
  it('are the terms and the privacy notice, and not the cookie policy (FR-206 informs)', () => {
    expect(ACCEPTED_LEGAL_DOCUMENTS).toEqual(['terms', 'privacy']);
    expect(isAcceptedLegalDocument('privacy')).toBe(true);
    expect(isAcceptedLegalDocument('cookies')).toBe(false);
  });

  it('are in force at the version each one’s standing names', () => {
    expect(LEGAL_VERSIONS_IN_FORCE).toEqual({
      terms: LEGAL_STANDING.terms.version,
      privacy: LEGAL_STANDING.privacy.version,
    });
  });
});
