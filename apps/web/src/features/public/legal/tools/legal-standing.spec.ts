import { describe, expect, it } from 'vitest';
import { LEGAL_DOCUMENT } from './legal-documents';
import { LEGAL_STANDING } from './legal-standing';

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
});
