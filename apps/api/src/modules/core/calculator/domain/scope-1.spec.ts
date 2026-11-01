import type { ConfigurationHistory } from '@api/infrastructure/configuration/configuration-history.service';
import { readSeedEntries, seedConfigurationStore } from '@api/testing/seed-configuration-store';
import type { CalcInput } from '../models/calc-run.model';
import type { FactorSet } from '../models/factor-set.model';
import { FactorSetCatalog } from '../services/factor-set-catalog.service';
import { LINE_OUTCOME } from './line-emission';
import { scope1 } from './scope-1';

/**
 * Scope 1 against the factor set the platform ships (task 38.2), with no database and no broker.
 *
 * **The expected figures were computed outside this code** — Python's `decimal` at fifty digits, from the shipped
 * factors — so a case here is a second calculation agreeing with the first, not the first one restated.
 */
describe('scope1', () => {
  const shipped = new FactorSetCatalog(
    seedConfigurationStore(readSeedEntries()),
    {} as ConfigurationHistory,
  ).inForce({ country: 'md', periodStart: '2026-01-01' }) as FactorSet;

  const line = (sourceId: string, sourceKey: string, quantity: string | null, unitCode: string | null): CalcInput => ({
    sourceId,
    siteOrdinal: 0,
    sourceKey,
    description: null,
    contents: { quantity, unitCode, notAvailableReason: quantity === null ? 'Not billed separately' : null },
    override: null,
    overriddenBy: null,
  });

  it('converts each line to MWh, applies its factor, and sums them exactly', () => {
    const total = scope1({
      factorSet: shipped,
      inputs: [line('gas', 'natural_gas', '500', 'm3'), line('van', 'diesel_road', '332', 'l'), line('stove', 'wood', '2.5', 't')],
    });

    expect(total.lines).toEqual([
      { outcome: LINE_OUTCOME.COMPUTED, sourceId: 'gas', ghgScope: 'scope_1', megawattHours: '4.78865', tonnesCo2e: '0.9699123256' },
      { outcome: LINE_OUTCOME.COMPUTED, sourceId: 'van', ghgScope: 'scope_1', megawattHours: '3.3310556', tonnesCo2e: '0.9026227980432' },
      { outcome: LINE_OUTCOME.COMPUTED, sourceId: 'stove', ghgScope: 'scope_1', megawattHours: '10.833325', tonnesCo2e: '0.35848772424' },
    ]);
    expect(total.tonnesCo2e).toBe('2.2310228478832');
    expect(total.unmeasured).toEqual([]);
  });

  it('leaves grid electricity out — it is Scope 2', () => {
    const total = scope1({
      factorSet: shipped,
      inputs: [line('gas', 'natural_gas', '500', 'm3'), line('grid', 'electricity_grid', '17000', 'kWh')],
    });
    expect(total.lines.map((each) => each.sourceId)).toEqual(['gas']);
    expect(total.tonnesCo2e).toBe('0.9699123256');
  });

  it('totals the measured lines and names the explained ones', () => {
    const total = scope1({
      factorSet: shipped,
      inputs: [line('gas', 'natural_gas', '500', 'm3'), line('boiler', 'heating_oil', null, null), line('van', 'diesel_road', '332', 'l')],
    });
    expect(total.tonnesCo2e).toBe('1.8725351236432');
    expect(total.unmeasured).toEqual(['boiler']);
    expect(total.lines.find((each) => each.sourceId === 'boiler')?.outcome).toBe(LINE_OUTCOME.NOT_AVAILABLE);
  });

  it('answers no total, not zero, where nothing of the scope was measured', () => {
    expect(scope1({ factorSet: shipped, inputs: [] }).tonnesCo2e).toBeNull();
    expect(scope1({ factorSet: shipped, inputs: [line('grid', 'electricity_grid', '17000', 'kWh')] }).tonnesCo2e).toBeNull();
    expect(scope1({ factorSet: shipped, inputs: [line('boiler', 'heating_oil', null, null)] })).toMatchObject({
      tonnesCo2e: null,
      unmeasured: ['boiler'],
    });
  });

  it('counts a measured zero as a figure, which is a nil return and not a missing one', () => {
    expect(scope1({ factorSet: shipped, inputs: [line('gas', 'natural_gas', '0', 'm3')] }).tonnesCo2e).toBe('0');
  });

  it('is the same total whatever order the lines arrive in', () => {
    const lines = [line('gas', 'natural_gas', '500', 'm3'), line('van', 'diesel_road', '332', 'l'), line('stove', 'wood', '2.5', 't')];
    expect(scope1({ factorSet: shipped, inputs: [...lines].reverse() }).tonnesCo2e).toBe(
      scope1({ factorSet: shipped, inputs: lines }).tonnesCo2e,
    );
  });

  it('refuses a line the set does not cover, rather than leaving it out of the total', () => {
    expect(() => scope1({ factorSet: shipped, inputs: [line('heat', 'district_heating', '12', 'Gcal')] })).toThrow(RangeError);
    expect(() => scope1({ factorSet: shipped, inputs: [line('gas', 'natural_gas', '12', 'Gcal')] })).toThrow(RangeError);
  });

  it('counts a line’s replacement figure, and keeps the computed one beside it (UC-34)', () => {
    const van = { ...line('van', 'diesel_road', '332', 'l'), override: { tonnesCo2e: '0.84', explanation: 'One van was sub-leased' } };
    const total = scope1({ factorSet: shipped, inputs: [line('gas', 'natural_gas', '500', 'm3'), van] });

    expect(total.lines[1]).toEqual({
      outcome: LINE_OUTCOME.OVERRIDDEN,
      sourceId: 'van',
      ghgScope: 'scope_1',
      megawattHours: '3.3310556',
      computedTonnesCo2e: '0.9026227980432',
      tonnesCo2e: '0.84',
      explanation: 'One van was sub-leased',
    });
    // 0.9699123256 + 0.84, the artboard's "gas 0,95 · diesel 0,84, your figure".
    expect(total.tonnesCo2e).toBe('1.8099123256');
    expect(total.unmeasured).toEqual([]);
  });
});
