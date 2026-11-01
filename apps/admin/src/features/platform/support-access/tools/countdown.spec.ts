import { describe, expect, it } from 'vitest';
import { minutesLeft } from './countdown';

const MINUTE = 60 * 1000;
const expiresAt = 1_000 * MINUTE;

describe('the grant countdown (task 67.9)', () => {
  it('reads a fresh grant as 60 minutes, and a part minute as the whole one it is in', () => {
    expect(minutesLeft({ expiresAt, now: expiresAt - 60 * MINUTE })).toBe(60);
    expect(minutesLeft({ expiresAt, now: expiresAt - 59 * MINUTE - 1 })).toBe(60);
    expect(minutesLeft({ expiresAt, now: expiresAt - 59 * MINUTE })).toBe(59);
  });

  it('keeps the last minute at 1 while the grant still admits a read, and never goes below 0', () => {
    expect(minutesLeft({ expiresAt, now: expiresAt - 1 })).toBe(1);
    expect(minutesLeft({ expiresAt, now: expiresAt })).toBe(0);
    expect(minutesLeft({ expiresAt, now: expiresAt + 5 * MINUTE })).toBe(0);
  });
});
