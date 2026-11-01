import type { ConfigurationHistory } from '@api/infrastructure/configuration/configuration-history.service';
import { readSeedEntries, seedConfigurationStore } from '@api/testing/seed-configuration-store';
import type { CalcInput } from '../models/calc-run.model';
import type { FactorSet } from '../models/factor-set.model';
import { FactorSetCatalog } from '../services/factor-set-catalog.service';
import { LINE_OUTCOME } from './line-emission';
import { scope1 } from './scope-1';
import { scope2LocationBased } from './scope-2-location-based';

/**
 * Location-based Scope 2 against the shipped `md` set (task 38.3), with no database and no broker. The expected
 * figures were computed outside this code, with Python's `decimal`, from the shipped grid factor (0.594645 tCO₂e/MWh).
 */
describe('scope2LocationBased', () => {
  const shipped = new FactorSetCatalog(
    seedConfigurationStore(readSeedEntries()),
    {} as ConfigurationHistory,
  ).inForce({ country: 'md', periodStart: '2026-01-01' }) as FactorSet;

  const line = (sourceId: string, sourceKey: string, quantity: string | null, unitCode: string | null): CalcInput => ({
    sourceId,
    siteOrdinal: 0,
    sourceKey,
    description: null,
    contents: { quantity, unitCode, notAvailableReason: quantity === null ? 'Billed by the landlord' : null },
    override: null,
    overriddenBy: null,
  });

  it('applies the grid factor to purchased electricity, in whichever unit the bill reads', () => {
    const total = scope2LocationBased({
      factorSet: shipped,
      inputs: [line('bakery', 'electricity_grid', '17000', 'kWh'), line('shop', 'electricity_grid', '12.5', 'MWh')],
    });

    expect(total.lines).toEqual([
      { outcome: LINE_OUTCOME.COMPUTED, sourceId: 'bakery', ghgScope: 'scope_2_location_based', megawattHours: '17', tonnesCo2e: '10.108965' },
      { outcome: LINE_OUTCOME.COMPUTED, sourceId: 'shop', ghgScope: 'scope_2_location_based', megawattHours: '12.5', tonnesCo2e: '7.4330625' },
    ]);
    expect(total.tonnesCo2e).toBe('17.5420275');
  });

  it('leaves the fuel burnt on site out — that is Scope 1', () => {
    const inputs = [line('gas', 'natural_gas', '500', 'm3'), line('bakery', 'electricity_grid', '17000', 'kWh')];

    expect(scope2LocationBased({ factorSet: shipped, inputs }).lines.map((each) => each.sourceId)).toEqual(['bakery']);
    // And the two scopes partition the lines between them: nothing counted twice, nothing dropped.
    const scope1Lines = scope1({ factorSet: shipped, inputs }).lines.map((each) => each.sourceId);
    expect([...scope1Lines, 'bakery'].sort()).toEqual(inputs.map((each) => each.sourceId).sort());
  });

  it('totals the measured sites and names the one billed by the landlord', () => {
    const total = scope2LocationBased({
      factorSet: shipped,
      inputs: [line('bakery', 'electricity_grid', '17000', 'kWh'), line('shop', 'electricity_grid', null, null)],
    });
    expect(total).toMatchObject({ tonnesCo2e: '10.108965', unmeasured: ['shop'] });
  });

  it('answers no total, not zero, where no electricity was measured', () => {
    expect(scope2LocationBased({ factorSet: shipped, inputs: [line('gas', 'natural_gas', '500', 'm3')] }).tonnesCo2e).toBeNull();
    expect(scope2LocationBased({ factorSet: shipped, inputs: [line('shop', 'electricity_grid', null, null)] }).tonnesCo2e).toBeNull();
  });

  it('refuses a unit the grid source is not billed in', () => {
    expect(() => scope2LocationBased({ factorSet: shipped, inputs: [line('bakery', 'electricity_grid', '17', 'Gcal')] })).toThrow(
      RangeError,
    );
  });
});
