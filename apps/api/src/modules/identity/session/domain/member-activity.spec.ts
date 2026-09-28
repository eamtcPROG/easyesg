import { ACTIVITY_GRAIN_MS, activityRecordedSince } from './member-activity';

/** The grain is the owner's number; a spec pins it so a change is a decision, not a drift. */
describe('member activity (FR-56)', () => {
  it('is recorded at a five-minute grain', () => {
    expect(ACTIVITY_GRAIN_MS).toBe(300_000);
  });

  it('leaves as it is anything recorded within the grain of now', () => {
    const now = new Date('2026-09-28T12:00:00Z');

    expect(activityRecordedSince(now)).toEqual(new Date('2026-09-28T11:55:00Z'));
  });
});
