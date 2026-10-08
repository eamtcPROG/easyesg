import type { RollUp } from '../models/roll-up.model';
import { hasStarted, isReadyToFile, outstandingByModule } from './report-notice-content';

const field = (elementKey: string, ordinal = 0) => ({ elementKey, dimensionKey: '', ordinal });

const ROLL_UP: RollUp = {
  report: { resolved: 9, reasoned: 1, outstanding: 4 },
  modules: [
    { module: 'B1', resolved: 5, reasoned: 0, outstanding: 2, outstandingFields: [field('AddressOfSite', 0), field('AddressOfSite', 1)] },
    { module: 'B2', resolved: 1, reasoned: 0, outstanding: 0, outstandingFields: [] },
    { module: 'B3', resolved: 3, reasoned: 1, outstanding: 2, outstandingFields: [field('TotalEnergyConsumption'), field('GrossScope1GreenhouseGasEmissions')] },
  ],
};

describe('outstandingByModule (task 51.2)', () => {
  it('names each module with something outstanding, in the roll-up’s order, each element once', () => {
    expect(outstandingByModule(ROLL_UP)).toEqual([
      { module: 'B1', elementKeys: ['AddressOfSite'] },
      { module: 'B3', elementKeys: ['TotalEnergyConsumption', 'GrossScope1GreenhouseGasEmissions'] },
    ]);
  });

  it('names nothing when nothing is outstanding', () => {
    expect(outstandingByModule({ ...ROLL_UP, modules: ROLL_UP.modules.map((m) => ({ ...m, outstandingFields: [] })) })).toEqual([]);
  });
});

describe('readiness and progress, as 41.3 reads them', () => {
  it('is ready only with nothing outstanding and something answered', () => {
    expect(isReadyToFile({ resolved: 3, reasoned: 0, outstanding: 0 })).toBe(true);
    expect(isReadyToFile({ resolved: 0, reasoned: 0, outstanding: 0 })).toBe(false);
    expect(isReadyToFile({ resolved: 3, reasoned: 0, outstanding: 1 })).toBe(false);
  });

  it('has started once anything is answered or declared not available', () => {
    expect(hasStarted({ resolved: 0, reasoned: 0, outstanding: 12 })).toBe(false);
    expect(hasStarted({ resolved: 0, reasoned: 1, outstanding: 12 })).toBe(true);
  });
});
