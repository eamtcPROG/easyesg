import { ENUMERATION_TAXONOMY, type TaxonomyAxis } from '@api/contracts/taxonomy-registry.port';
import type { Locale } from '@easyesg/i18n';
import { aLabel, aMember, anAxis, anElement } from '../testing/step-read.fakes';
import { MemberResolver } from './member-resolver';

/**
 * Task 133.2: an element's member-keyed rows, a classification's picker and what it admits — over a registry that
 * answers axes and records each time it is asked. No container, no configuration store.
 */
const ENERGY = anAxis({
  key: 'BreakdownOfEnergyConsumptionAxis',
  defaultMember: 'TotalMember',
  members: [aMember({ key: 'RenewableMember' }), aMember({ key: 'NonRenewableMember' })],
});
const WASTE = anAxis({
  key: 'TypeOfWasteAxis',
  defaultMember: 'TypeOfWasteMember',
  members: [
    // A category, and two of its entries — only the entries carry the hazard B7 reports on.
    aMember({ key: 'Ch01', code: '01', labels: { en: 'Mining wastes' } }),
    aMember({ key: 'W010101', code: '01 01 01', parent: 'Ch01', hazardous: false, labels: { en: 'Metallic wastes' } }),
    aMember({
      key: 'W010304',
      code: '01 03 04*',
      parent: 'Ch01',
      hazardous: true,
      labels: { en: 'Acid tailings', ro: 'Steril acid' },
    }),
  ],
});
const COUNTRY = anAxis({
  key: 'CountryOfEmploymentContractAxis',
  memberTaxonomy: ENUMERATION_TAXONOMY.COUNTRY,
  members: [aMember({ key: 'MD' }), aMember({ key: 'NT' })],
});
const SITE = anAxis({ key: 'IdentifierOfSiteTypedAxis', typed: true });

class RecordingAxes {
  readonly asked: string[] = [];

  constructor(private readonly axes: readonly TaxonomyAxis[]) {}

  axis(query: { readonly key: string }): TaxonomyAxis | null {
    this.asked.push(query.key);
    return this.axes.find((axis) => axis.key === query.key) ?? null;
  }
}

const resolver = (over: { readonly locale?: Locale; readonly registry?: RecordingAxes } = {}) =>
  new MemberResolver({
    registered: { standard: 'vsme', version: '2026-05-01' },
    taxonomy: over.registry ?? new RecordingAxes([ENERGY, WASTE, COUNTRY, SITE]),
    memberLabels: {
      TotalMember: aLabel('Total'),
      W010101: aLabel('Deșeuri metalice'),
      TypeOfWasteMember: aLabel('Tip de deșeu'),
    },
    locale: over.locale ?? 'ro',
    breakdownAxes: new Set([ENERGY.key, SITE.key]),
    classificationAxes: new Set([WASTE.key, COUNTRY.key, SITE.key]),
  });

describe('MemberResolver', () => {
  describe('membersFor', () => {
    it('answers a breakdown’s rows with the default member — the total — first, asking the registry once', () => {
      const registry = new RecordingAxes([ENERGY]);
      const members = resolver({ registry });
      const fuels = anElement({ key: 'EnergyConsumptionFromFuels', axes: [ENERGY.key] });
      const electricity = anElement({ key: 'EnergyConsumptionFromElectricity', axes: [ENERGY.key] });

      expect(members.membersFor(fuels)).toEqual(['TotalMember', 'RenewableMember', 'NonRenewableMember']);
      expect(members.membersFor(electricity)).toEqual(['TotalMember', 'RenewableMember', 'NonRenewableMember']);
      expect(registry.asked).toEqual([ENERGY.key]);
    });

    it('answers no rows for an axis nobody registered as a breakdown, or a typed one that was', () => {
      const members = resolver();

      expect(members.membersFor(anElement({ key: 'WasteGenerated', axes: [WASTE.key] }))).toEqual([]);
      expect(members.membersFor(anElement({ key: 'AddressOfSite', axes: [SITE.key] }))).toEqual([]);
      expect(members.membersFor(anElement({ key: 'NumberOfEmployees' }))).toEqual([]);
    });
  });

  describe('classificationFor', () => {
    it('answers the classification an element is selected along, and never a typed axis', () => {
      const members = resolver();

      expect(members.classificationFor(anElement({ key: 'WasteGenerated', axes: [WASTE.key] }))).toBe(WASTE.key);
      expect(members.classificationFor(anElement({ key: 'AddressOfSite', axes: [SITE.key] }))).toBeNull();
      expect(members.classificationFor(anElement({ key: 'EnergyConsumptionFromFuels', axes: [ENERGY.key] }))).toBeNull();
    });
  });

  describe('labelFor', () => {
    it('names a member from the catalogue, and an undimensioned row not at all', () => {
      const members = resolver();

      expect(members.labelFor('TotalMember')).toBe('Total');
      expect(members.labelFor('RenewableMember')).toBeNull();
      expect(members.labelFor('')).toBeNull();
    });
  });

  describe('domainOf', () => {
    it('offers the leaves alone — never a category, never the domain’s root — named best-first', () => {
      const domain = resolver().domainOf(WASTE.key);

      expect(domain).toEqual({
        key: WASTE.key,
        label: 'Tip de deșeu',
        members: [
          // The platform's catalogue first; then the classification's own name in the reader's language.
          { value: 'W010101', code: '01 01 01', hazardous: false, label: 'Deșeuri metalice' },
          { value: 'W010304', code: '01 03 04*', hazardous: true, label: 'Steril acid' },
        ],
        memberLanguage: null,
      });
    });

    it('falls back to the published English, and says the names were borrowed', () => {
      const domain = resolver({ locale: 'ru' }).domainOf(WASTE.key);

      expect(domain?.members.map((member) => member.label)).toEqual(['Deșeuri metalice', 'Acid tailings']);
      expect(domain?.memberLanguage).toBe('en');
    });

    it('names a country in the reader’s language, borrowing nothing, and leaves a withdrawn code unnamed', () => {
      const domain = resolver({ locale: 'en' }).domainOf(COUNTRY.key);

      expect(domain?.members).toEqual([
        { value: 'MD', code: null, hazardous: null, label: 'Moldova' },
        { value: 'NT', code: null, hazardous: null, label: null },
      ]);
      expect(domain?.memberLanguage).toBeNull();
    });

    it('answers no domain for a typed axis or one the version does not register', () => {
      const members = resolver();

      expect(members.domainOf(SITE.key)).toBeNull();
      expect(members.domainOf('UnregisteredAxis')).toBeNull();
    });
  });

  describe('admits', () => {
    it('admits a leaf of the axis, and refuses a category, a stranger and an axis it does not know', () => {
      const members = resolver();

      expect(members.admits({ axis: WASTE.key, member: 'W010304' })).toBe(true);
      expect(members.admits({ axis: WASTE.key, member: 'Ch01' })).toBe(false);
      expect(members.admits({ axis: WASTE.key, member: 'MD' })).toBe(false);
      expect(members.admits({ axis: 'UnregisteredAxis', member: 'W010304' })).toBe(false);
    });
  });
});
