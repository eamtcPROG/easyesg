import { describe, expect, it } from 'vitest';
import { isReadable, pauseDwell, resumeDwell, startDwell } from './dwell';

const HOLDS_NONE = { hovered: false, focused: false, offScreen: false, documentHidden: false };

describe('the dwell clock (§8.1, Success)', () => {
  it('starts stopped, with the whole dwell left', () => {
    expect(startDwell(8000)).toStrictEqual({ remainingMs: 8000, runningSince: null });
  });

  it('keeps what is left across a pause and a resume', () => {
    const running = resumeDwell(startDwell(8000), 1000);
    const paused = pauseDwell(running, 4000);
    expect(paused).toStrictEqual({ remainingMs: 5000, runningSince: null });

    // The time spent paused is not counted: resumed at 60 s, it still has the five it had.
    expect(resumeDwell(paused, 60_000)).toStrictEqual({ remainingMs: 5000, runningSince: 60_000 });
  });

  it('adds up several readable stretches', () => {
    let clock = startDwell(8000);
    clock = pauseDwell(resumeDwell(clock, 0), 3000);
    clock = pauseDwell(resumeDwell(clock, 10_000), 12_000);
    expect(clock.remainingMs).toBe(3000);
  });

  it('keeps the first start when resumed twice, so a second report loses nothing', () => {
    const once = resumeDwell(startDwell(8000), 1000);
    expect(resumeDwell(once, 5000)).toBe(once);
  });

  it('changes nothing when paused while already stopped', () => {
    const paused = pauseDwell(resumeDwell(startDwell(8000), 0), 2000);
    expect(pauseDwell(paused, 9000)).toBe(paused);
  });

  it('never goes below zero when a pause arrives after the dwell ran out', () => {
    expect(pauseDwell(resumeDwell(startDwell(8000), 0), 20_000).remainingMs).toBe(0);
  });
});

describe('what stops it', () => {
  it('runs only while nothing holds it', () => {
    expect(isReadable(HOLDS_NONE)).toBe(true);
  });

  it.each(['hovered', 'focused', 'offScreen', 'documentHidden'] as const)('stops while %s', (hold) => {
    expect(isReadable({ ...HOLDS_NONE, [hold]: true })).toBe(false);
  });
});
