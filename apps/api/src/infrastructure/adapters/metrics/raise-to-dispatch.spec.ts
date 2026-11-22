import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NFR_106_THRESHOLD_SECONDS, RAISE_TO_DISPATCH, secondsSinceRaise } from './raise-to-dispatch';

/**
 * NFR-106's instrument (task 202): the interval, the buckets, and the two files that read the series by name.
 */
describe('raise-to-dispatch (task 202)', () => {
  const RAISED_AT_MICROS = 1_790_726_400_000_000;

  describe('secondsSinceRaise', () => {
    it('measures from the raise, to the microsecond', () => {
      expect(secondsSinceRaise({ raisedAtMicros: RAISED_AT_MICROS - 1_500, now: new Date(RAISED_AT_MICROS / 1000 + 2_000) })).toBe(
        2.0015,
      );
    });

    it('reads a worker clock behind the database’s as zero, not as a negative interval', () => {
      expect(secondsSinceRaise({ raisedAtMicros: RAISED_AT_MICROS, now: new Date(RAISED_AT_MICROS / 1000 - 400) })).toBe(0);
    });
  });

  it('has a bucket boundary at exactly NFR-106’s threshold, in ascending order', () => {
    expect(RAISE_TO_DISPATCH.buckets).toContain(NFR_106_THRESHOLD_SECONDS);
    expect([...RAISE_TO_DISPATCH.buckets].sort((a, b) => a - b)).toEqual(RAISE_TO_DISPATCH.buckets);
  });

  /**
   * **The rules and the dashboard cannot import the name**, so they are held to it here: a rename of the series, or of
   * its label, that left them reading nothing would otherwise pass every gate and show an empty panel. **Comment lines
   * are not read**: the rules' header names the series and the bound too, and a check that matched it would pass over
   * an expression reading nothing.
   */
  const read = (path: string): string =>
    readFileSync(join(__dirname, '../../../../../../', path), 'utf8')
      .split('\n')
      .filter((line) => !line.trimStart().startsWith('#'))
      .join('\n');
  const RULES = 'infra/compose/prometheus/rules/notification-dispatch.yml';

  const DASHBOARD = 'infra/compose/grafana/dashboards/notification-dispatch.json';

  describe.each([
    ['the recording rules', RULES],
    ['the dashboard', DASHBOARD],
  ])('%s', (_reader, path) => {
    it('reads the series this instrument writes and no other, by its channel label', () => {
      const text = read(path);
      const named = [...text.matchAll(/\beasyesg_\w+?_(?:bucket|count|sum)\b/g)].map((match) =>
        match[0].replace(/_(?:bucket|count|sum)$/, ''),
      );
      expect(named.length).toBeGreaterThan(0);
      expect(new Set(named)).toEqual(new Set([RAISE_TO_DISPATCH.name]));

      const groupings = [...text.matchAll(/\bby \(([^)]*)\)/g)].map((match) =>
        match[1].split(',').map((label) => label.trim()),
      );
      expect(groupings.length).toBeGreaterThan(0);
      for (const labels of groupings) expect(labels).toContain(RAISE_TO_DISPATCH.channelLabel);
    });
  });

  it('has the dashboard read only series the recording rules record', () => {
    const recorded = new Set([...read(RULES).matchAll(/record: (\S+)/g)].map((match) => match[1]));
    const readByDashboard = [...read(DASHBOARD).matchAll(/"expr": "(channel:[\w:]+)"/g)].map((match) => match[1]);
    expect(readByDashboard.length).toBeGreaterThan(0);
    for (const name of readByDashboard) expect(recorded).toContain(name);
  });

  // Prometheus 3 stores a classic histogram's bound as a float, so `le="60"` would select no series at all.
  it('has the recording rules read the share within NFR-106’s threshold at its own bucket, as Prometheus stores it', () => {
    expect(read(RULES)).toContain(`_bucket{le="${NFR_106_THRESHOLD_SECONDS.toFixed(1)}"}`);
  });
});
