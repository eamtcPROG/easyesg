import { LABEL_STANDING, type DisclosureLabel } from '@easyesg/i18n';
import type { Finding } from '@easyesg/validation';
import { placeFindings } from './finding-places';

/** A finding's field named and placed (task 42.2; FR-42) — the read's naming, as a pure rule. */
const finding = (over: Partial<Finding> = {}): Finding => ({
  rule: 'b8-gender',
  verdict: 'inconsistency',
  field: { elementKey: 'NumberOfMaleEmployees', dimensionKey: '', ordinal: 0 },
  related: [{ elementKey: 'NumberOfEmployees', dimensionKey: '', ordinal: 0 }],
  message: 'validation.sum.inconsistent',
  params: { parts: '40', total: '52' },
  ...over,
});

const worded = (text: string): DisclosureLabel => ({ text, standing: LABEL_STANDING.OFFICIAL });
const LABELS: Readonly<Record<string, DisclosureLabel>> = {
  NumberOfMaleEmployees: worded('Numărul de angajați bărbați'),
  NumberOfEmployees: worded('Numărul de angajați'),
  EnergyConsumptionFromElectricity: worded('Consumul de energie electrică'),
};
const MEMBERS: Readonly<Record<string, DisclosureLabel>> = { RenewableEnergyMember: worded('Regenerabilă') };
const PLACED = new Map<string, readonly string[]>([
  ['NumberOfMaleEmployees', ['B8']],
  ['NumberOfEmployees', ['B1', 'B8']],
  ['EnergyConsumptionFromElectricity', ['B3']],
]);

describe('placeFindings', () => {
  it('names the field and each related one by its label, and places each in the modules presenting it', () => {
    const [placed] = placeFindings({ findings: [finding()], placedIn: PLACED, labels: LABELS, members: MEMBERS });
    expect(placed?.field).toEqual({
      elementKey: 'NumberOfMaleEmployees',
      dimensionKey: '',
      ordinal: 0,
      label: 'Numărul de angajați bărbați',
      memberLabel: null,
      modules: ['B8'],
    });
    expect(placed?.related).toEqual([
      expect.objectContaining({ label: 'Numărul de angajați', modules: ['B1', 'B8'] }),
    ]);
    // The rest of the finding is carried as it was.
    expect(placed).toMatchObject({ rule: 'b8-gender', message: 'validation.sum.inconsistent', params: { total: '52' } });
  });

  it('names a member the catalogue words, and leaves one it does not — a country — unnamed, never its key', () => {
    const [worded, country] = placeFindings({
      findings: [
        finding({ field: { elementKey: 'EnergyConsumptionFromElectricity', dimensionKey: 'RenewableEnergyMember', ordinal: 0 } }),
        finding({ field: { elementKey: 'NumberOfMaleEmployees', dimensionKey: 'MD', ordinal: 0 } }),
      ],
      placedIn: PLACED,
      labels: LABELS,
      members: MEMBERS,
    });
    expect(worded?.field.memberLabel).toBe('Regenerabilă');
    expect(country?.field.memberLabel).toBeNull();
  });

  it('places a field the scope no longer presents nowhere, and names nothing where no labels are registered', () => {
    const [placed] = placeFindings({
      findings: [finding({ field: { elementKey: 'Turnover', dimensionKey: '', ordinal: 0 } })],
      placedIn: PLACED,
      labels: null,
      members: null,
    });
    expect(placed?.field).toMatchObject({ label: null, modules: [] });
  });
});
