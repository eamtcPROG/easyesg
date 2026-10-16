import type { TaxonomyAxis, TaxonomyMember } from '@api/contracts/taxonomy-registry.port';
import { admitsMember, breakdownMembers } from './axis-leaves';

/** Task 217: which members an axis admits as an answer — one rule for the step read's rows and the write's check. */
const member = (key: string, parent: string | null = null): TaxonomyMember => ({
  key,
  code: null,
  hazardous: null,
  parent,
  labels: {},
});

const axis = (input: Pick<TaxonomyAxis, 'key' | 'defaultMember'> & { readonly members: readonly TaxonomyMember[] }) =>
  ({ typed: false, memberTaxonomy: null, ...input }) as TaxonomyAxis;

/** B3's energy breakdown as the artefact registers it: the total is the default member, never a listed one. */
const ENERGY = axis({
  key: 'BreakdownOfEnergyConsumptionAxis',
  defaultMember: 'TotalRenewableAndNonRenewableEnergyMember',
  members: [member('RenewableEnergyMember'), member('NonRenewableEnergyMember')],
});

/** B4's pollutants: its default member is the domain's head, a category. */
const POLLUTANTS = axis({
  key: 'TypeOfPollutantAxis',
  defaultMember: 'TypeOfPollutantMember',
  members: [member('AlachlorMember'), member('AmmoniaMember')],
});

/** A two-level list, as B7's waste list is: a chapter and the entry under it. */
const WASTE = axis({
  key: 'TypesOfWasteAxis',
  defaultMember: null,
  members: [member('ChapterMember'), member('EntryMember', 'ChapterMember')],
});

describe('breakdownMembers', () => {
  it('serves the total first, then the parts', () => {
    expect(breakdownMembers(ENERGY)).toEqual([
      'TotalRenewableAndNonRenewableEnergyMember',
      'RenewableEnergyMember',
      'NonRenewableEnergyMember',
    ]);
  });

  it('serves only the members where the axis names no default', () => {
    expect(breakdownMembers(WASTE)).toEqual(['ChapterMember', 'EntryMember']);
  });
});

describe('admitsMember', () => {
  it('admits a breakdown’s total — the row the step read serves first', () => {
    expect(
      admitsMember({ axis: ENERGY, member: 'TotalRenewableAndNonRenewableEnergyMember', breakdown: true }),
    ).toBe(true);
  });

  it('admits every row a breakdown serves, and nothing else', () => {
    for (const key of breakdownMembers(ENERGY)) {
      expect(admitsMember({ axis: ENERGY, member: key, breakdown: true })).toBe(true);
    }
    expect(admitsMember({ axis: ENERGY, member: 'NotAnEnergyMember', breakdown: true })).toBe(false);
  });

  it('refuses a classification’s default member, which is its domain’s head', () => {
    expect(admitsMember({ axis: POLLUTANTS, member: 'TypeOfPollutantMember', breakdown: false })).toBe(false);
    expect(admitsMember({ axis: POLLUTANTS, member: 'AlachlorMember', breakdown: false })).toBe(true);
  });

  it('refuses a category off a breakdown, and admits the leaf under it', () => {
    expect(admitsMember({ axis: WASTE, member: 'ChapterMember', breakdown: false })).toBe(false);
    expect(admitsMember({ axis: WASTE, member: 'EntryMember', breakdown: false })).toBe(true);
  });

  it('holds the total to the breakdown — the same axis read as anything else refuses it', () => {
    expect(
      admitsMember({ axis: ENERGY, member: 'TotalRenewableAndNonRenewableEnergyMember', breakdown: false }),
    ).toBe(false);
  });
});
