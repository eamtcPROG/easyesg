import { DISCLOSURE_KIND } from '@easyesg/vsme';
import { PERIOD_TYPE } from '@api/contracts/taxonomy-registry.port';
import { ReportNotFoundError } from '@api/modules/core/disclosure/errors/report.errors';
import { COMPARABILITY, PRIOR_PERIOD_AVAILABILITY } from '../models/prior-period-value.model';
import {
  FakeElementRegistry,
  FakePriorPeriodStore,
  element,
  readout,
  storedValue,
} from '../testing/comparatives.fakes';
import { ReadPriorPeriodValues } from './read-prior-period-values.use-case';

const CURRENT = '2026-05-01';
const PRIOR = '2025-01-01';
const REPORT = '01920000-0000-7000-8000-00000000aaaa';

const priorReport = (taxonomyVersion: string, values = [storedValue()]) => ({
  reportId: '01920000-0000-7000-8000-00000000bbbb',
  periodId: '01920000-0000-7000-8000-00000000cccc',
  fiscalYear: 2025,
  taxonomyVersion,
  values,
});

const read = async (store: FakePriorPeriodStore, registry: FakeElementRegistry) =>
  new ReadPriorPeriodValues(store, registry).read({ reportId: REPORT });

/** No version pair is consulted in these, so any registry will do. */
const noRegistry = () => new FakeElementRegistry({});

describe('ReadPriorPeriodValues (UC-45; FR-45, FR-46)', () => {
  it('refuses a report the tenant cannot see, the same way a missing one is refused', async () => {
    // RLS makes "not yours" and "not there" one answer (task 31.3), so this use case must not
    // invent a distinction the database deliberately withholds.
    await expect(read(new FakePriorPeriodStore(null), noRegistry())).rejects.toBeInstanceOf(
      ReportNotFoundError,
    );
  });

  describe('when there is nothing to compare against', () => {
    it('distinguishes a first year from a prior period nobody reported on', async () => {
      const firstYear = await read(
        new FakePriorPeriodStore(readout({ priorPeriodLinked: false })),
        noRegistry(),
      );
      const unreported = await read(
        new FakePriorPeriodStore(readout({ priorPeriodLinked: true })),
        noRegistry(),
      );

      // The two are different situations for a reporter, and collapsing them into an empty list
      // would make the second invisible — FR-45 is about the linkage, and here it exists.
      expect(firstYear.availability).toBe(PRIOR_PERIOD_AVAILABILITY.NO_PRIOR_PERIOD);
      expect(unreported.availability).toBe(PRIOR_PERIOD_AVAILABILITY.NO_PRIOR_REPORT);
      expect(firstYear.prior).toBeNull();
      expect(firstYear.values).toEqual([]);
    });
  });

  describe('across two pinned taxonomy versions (DR-4)', () => {
    it('reads the same pin as comparable without asking the registry at all', async () => {
      const registry = new FakeElementRegistry({});
      const answer = await read(
        new FakePriorPeriodStore(readout({ priorPeriodLinked: true, prior: priorReport(CURRENT) })),
        registry,
      );

      expect(answer.values[0].comparability).toBe(COMPARABILITY.COMPARABLE);
      // The short-circuit is the assertion: a registry that answers nothing would otherwise make
      // every same-version value `element_absent`, which is the bug this guards.
      expect(registry.askedFor).toEqual([]);
    });

    it('consults the current version and the prior version, in that order', async () => {
      const registry = new FakeElementRegistry({ [CURRENT]: element(), [PRIOR]: element() });
      await read(
        new FakePriorPeriodStore(readout({ priorPeriodLinked: true, prior: priorReport(PRIOR) })),
        registry,
      );

      // Swapped, every other assertion in this file still passes — which is exactly why the two
      // version parameters are named rather than positional, and why this is asserted.
      expect(registry.askedFor.map((asked) => asked.version)).toEqual([CURRENT, PRIOR]);
    });

    it('calls an element the current taxonomy no longer names absent, not incomparable', async () => {
      const answer = await read(
        new FakePriorPeriodStore(readout({ priorPeriodLinked: true, prior: priorReport(PRIOR) })),
        new FakeElementRegistry({ [CURRENT]: null, [PRIOR]: element() }),
      );

      expect(answer.values[0].comparability).toBe(COMPARABILITY.ELEMENT_ABSENT);
      // Still returned, with its version beside it. Dropping it would lose a reporter's comparative
      // to a taxonomy bump, and FR-45 makes comparatives mandatory from year two.
      expect(answer.availability).toBe(PRIOR_PERIOD_AVAILABILITY.AVAILABLE);
      expect(answer.prior?.taxonomyVersion).toBe(PRIOR);
    });

    it('calls a changed kind a changed shape', async () => {
      const answer = await read(
        new FakePriorPeriodStore(readout({ priorPeriodLinked: true, prior: priorReport(PRIOR) })),
        new FakeElementRegistry({
          [CURRENT]: element({ kind: DISCLOSURE_KIND.MONETARY }),
          [PRIOR]: element({ kind: DISCLOSURE_KIND.NUMERIC }),
        }),
      );

      expect(answer.values[0].comparability).toBe(COMPARABILITY.SHAPE_CHANGED);
    });

    it('calls a changed period type a changed shape, which is why the registry carries it', async () => {
      // `PERIOD_TYPE`'s own header says duration and instant facts "are compared differently
      // against the prior period (FR-46)" — a headcount as-at a date is not a headcount over a year.
      const answer = await read(
        new FakePriorPeriodStore(readout({ priorPeriodLinked: true, prior: priorReport(PRIOR) })),
        new FakeElementRegistry({
          [CURRENT]: element({ periodType: PERIOD_TYPE.DURATION }),
          [PRIOR]: element({ periodType: PERIOD_TYPE.INSTANT }),
        }),
      );

      expect(answer.values[0].comparability).toBe(COMPARABILITY.SHAPE_CHANGED);
    });

    it('calls an unchanged element comparable across different versions', async () => {
      const answer = await read(
        new FakePriorPeriodStore(readout({ priorPeriodLinked: true, prior: priorReport(PRIOR) })),
        new FakeElementRegistry({ [CURRENT]: element(), [PRIOR]: element() }),
      );

      expect(answer.values[0].comparability).toBe(COMPARABILITY.COMPARABLE);
      // Both pins travel with the answer. A comparative that did not say which two versions
      // produced it is the "two disagreeing pins with nothing failing" shape, one layer up.
      expect(answer.taxonomyVersion).toBe(CURRENT);
      expect(answer.prior?.taxonomyVersion).toBe(PRIOR);
    });

    it('refuses to call a withdrawn prior version comparable', async () => {
      // The prior element ought to exist — the value was authored against it — but a version
      // withdrawn from the registry answers null for every key, and `comparable` would then assert
      // an equality nothing checked.
      const answer = await read(
        new FakePriorPeriodStore(readout({ priorPeriodLinked: true, prior: priorReport(PRIOR) })),
        new FakeElementRegistry({ [CURRENT]: element(), [PRIOR]: null }),
      );

      expect(answer.values[0].comparability).toBe(COMPARABILITY.ELEMENT_ABSENT);
    });
  });
});
