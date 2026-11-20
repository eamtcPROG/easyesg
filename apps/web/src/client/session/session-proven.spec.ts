import { afterEach, describe, expect, it } from 'vitest';
import {
  SESSION_PROVEN_WINDOW_MS,
  forgetSessionProof,
  noteSessionProven,
  sessionRecentlyProven,
} from './session-proven';

afterEach(forgetSessionProof);

describe('the session proven recently', () => {
  it('is not proven before anything answered', () => {
    expect(sessionRecentlyProven(1_000)).toBe(false);
  });

  it('holds inside the window and lapses at its end', () => {
    noteSessionProven(10_000);
    expect(sessionRecentlyProven(10_000 + SESSION_PROVEN_WINDOW_MS - 1)).toBe(true);
    expect(sessionRecentlyProven(10_000 + SESSION_PROVEN_WINDOW_MS)).toBe(false);
  });

  it('is forgotten when the session ends', () => {
    noteSessionProven(10_000);
    forgetSessionProof();
    expect(sessionRecentlyProven(10_001)).toBe(false);
  });
});
