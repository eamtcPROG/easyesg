import { describe, expect, it } from 'vitest';
import { CONNECTION } from '@/features/wizard/tools/autosave-state';
import { RUN_STANDING, runStanding } from './run-standing';

const ready = {
  readOnly: false,
  hasFactorSet: true,
  lines: 2,
  connection: CONNECTION.ONLINE,
  unsynced: false,
  uncovered: 0,
};

describe('runStanding (task 39.2)', () => {
  it('is ready with lines, a set, a connection and nothing waiting', () => {
    expect(runStanding(ready)).toBe(RUN_STANDING.READY);
  });

  it.each([
    ['nothing may be written', { readOnly: true }, RUN_STANDING.READ_ONLY],
    ['no set serves the period', { hasFactorSet: false }, RUN_STANDING.NO_FACTOR_SET],
    ['there are no lines', { lines: 0 }, RUN_STANDING.NO_LINES],
    ['the browser is offline — the run needs the server', { connection: CONNECTION.OFFLINE }, RUN_STANDING.OFFLINE],
    ['a line is still waiting to be sent — the run would miss it', { unsynced: true }, RUN_STANDING.UNSENT],
    ['a line the set no longer covers — the run would refuse it', { uncovered: 1 }, RUN_STANDING.UNCOVERED],
  ])('waits when %s', (_case, change, standing) => {
    expect(runStanding({ ...ready, ...change })).toBe(standing);
  });

  it('names the reason worth reading first', () => {
    expect(runStanding({ ...ready, readOnly: true, connection: CONNECTION.OFFLINE })).toBe(RUN_STANDING.READ_ONLY);
    expect(runStanding({ ...ready, connection: CONNECTION.OFFLINE, unsynced: true })).toBe(RUN_STANDING.OFFLINE);
  });
});
