import {
  APPLICABILITY_CONDITION,
  DISCLOSURE_KIND,
  DISCLOSURE_ORIGIN,
  DISCLOSURE_STATE,
  type ApplicabilityCause,
  type DisclosureField,
} from '@easyesg/contracts';
import { describe, expect, it } from 'vitest';
import {
  applicabilityNotes,
  forgetNotAsked,
  isRetained,
  laidOutFields,
  notesByEntry,
  undismissed,
} from './applicability-notes';
import { layOutStep } from './step-layout';

const field = (over: Partial<DisclosureField> & { elementKey: string }): DisclosureField => ({
  changeCount: 0,
  places: null,
  dimensionKey: '',
  dimensionLabel: null,
  origin: DISCLOSURE_ORIGIN.REPORTED,
  derived: false,
  explanation: null,
  overriddenBy: null,
  ordinal: 0,
  currency: null,
  kind: DISCLOSURE_KIND.NUMERIC,
  periodType: 'duration',
  axes: [],
  repeating: false,
  order: 0,
  label: null,
  labelStanding: null,
  help: null,
  helpStanding: null,
  options: null,
  defaultValue: null,
  valueNumeric: null,
  valueText: null,
  valueBoolean: null,
  valueDate: null,
  unitCode: null,
  unitCodes: [],
  state: DISCLOSURE_STATE.OK,
  notAvailableReason: null,
  carriedForward: false,
  fromRecord: false,
  applicable: true,
  applicabilityCause: null,
  ...over,
});

const headcount = (answer: string | null): ApplicabilityCause => ({
  condition: APPLICABILITY_CONDITION.NUMERIC_AT_LEAST,
  drivers: [{ elementKey: 'NumberOfEmployees', label: 'Numărul de angajați' }],
  threshold: '50',
  answer,
});

const sites: ApplicabilityCause = {
  condition: APPLICABILITY_CONDITION.ANY_ROW_ANSWERED,
  drivers: [{ elementKey: 'AddressOfSite', label: 'Adresa amplasamentului' }],
  threshold: null,
  answer: null,
};

describe('applicabilityNotes', () => {
  it('gives a field a rule governs a note, and an ungoverned field none', () => {
    const notes = applicabilityNotes([
      field({ elementKey: 'TotalSealedArea', label: 'Suprafața impermeabilizată' }),
      field({ elementKey: 'EmployeeTurnoverRate', label: 'Rata de fluctuație', applicabilityCause: headcount('52') }),
    ]);
    expect(notes.map((note) => note.elementKeys)).toEqual([['EmployeeTurnoverRate']]);
    expect(notes[0]?.labels).toEqual(['Rata de fluctuație']);
  });

  it('names every field one cause brought in one note, each element once however many rows ask it', () => {
    const notes = applicabilityNotes([
      field({ elementKey: 'SiteLocatedInABiodiversitySensitiveArea', ordinal: 0, label: 'În zonă', applicabilityCause: sites }),
      field({ elementKey: 'AreaOfSiteInBiodiversitySensitiveArea', ordinal: 0, label: 'Suprafața', applicabilityCause: sites }),
      field({ elementKey: 'SiteLocatedInABiodiversitySensitiveArea', ordinal: 1, label: 'În zonă', applicabilityCause: sites }),
    ]);
    expect(notes).toHaveLength(1);
    expect(notes[0]?.elementKeys).toEqual([
      'SiteLocatedInABiodiversitySensitiveArea',
      'AreaOfSiteInBiodiversitySensitiveArea',
    ]);
    expect(notes[0]?.labels).toEqual(['În zonă', 'Suprafața']);
  });

  it('keeps two causes apart — a different answer is a different reason', () => {
    const notes = applicabilityNotes([
      field({ elementKey: 'EmployeeTurnoverRate', applicabilityCause: headcount('52') }),
      field({ elementKey: 'PercentageGapInPayBetweenFemaleAndMaleEmployees', applicabilityCause: headcount('160') }),
    ]);
    expect(notes).toHaveLength(2);
  });

  it('leaves out a label the catalogue does not hold rather than naming the element key', () => {
    const [note] = applicabilityNotes([field({ elementKey: 'EmployeeTurnoverRate', applicabilityCause: headcount('52') })]);
    expect(note?.labels).toEqual([]);
    expect(note?.elementKeys).toEqual(['EmployeeTurnoverRate']);
  });
});

describe('isRetained', () => {
  const hidden = { applicable: false, applicabilityCause: headcount('12') };

  it('holds for a hidden field with a stored answer, a zero included', () => {
    expect(isRetained(field({ elementKey: 'EmployeeTurnoverRate', ...hidden, valueNumeric: '0' }))).toBe(true);
  });

  it('holds for a hidden field declared not available, which is an answer with no value', () => {
    expect(
      isRetained(field({ elementKey: 'EmployeeTurnoverRate', ...hidden, state: DISCLOSURE_STATE.NOT_AVAILABLE })),
    ).toBe(true);
  });

  it('does not hold for a hidden field holding nothing — `ok` with empty columns is no answer since task 42.1', () => {
    expect(isRetained(field({ elementKey: 'EmployeeTurnoverRate', ...hidden }))).toBe(false);
  });

  it('does not hold for a field still asked, answered or not', () => {
    expect(isRetained(field({ elementKey: 'EmployeeTurnoverRate', valueNumeric: '4' }))).toBe(false);
  });
});

describe('laidOutFields', () => {
  it('keeps the asked fields and the hidden ones with a kept answer, and drops a hidden empty one', () => {
    const asked = field({ elementKey: 'TotalSealedArea' });
    const kept = field({ elementKey: 'EmployeeTurnoverRate', applicable: false, valueNumeric: '8' });
    const gone = field({ elementKey: 'PercentageGapInPayBetweenFemaleAndMaleEmployees', applicable: false });
    expect(laidOutFields([asked, kept, gone])).toEqual([asked, kept]);
  });
});

describe('notesByEntry', () => {
  it('stands each note before the first entry presenting one of its fields', () => {
    const fields = [
      field({ elementKey: 'TotalUseOfLand', order: 1 }),
      field({ elementKey: 'EmployeeTurnoverRate', order: 2, applicabilityCause: headcount('52') }),
      field({ elementKey: 'TotalSealedArea', order: 3 }),
    ];
    const entries = layOutStep(fields, new Set());
    const placed = notesByEntry({ entries, notes: applicabilityNotes(fields) });
    expect([...placed.keys()]).toEqual([1]);
    expect(placed.get(1)?.[0]?.elementKeys).toEqual(['EmployeeTurnoverRate']);
  });

  it('finds a note’s field inside a repeating group', () => {
    const fields = [
      field({ elementKey: 'TotalUseOfLand', order: 1 }),
      field({
        elementKey: 'SiteLocatedInABiodiversitySensitiveArea',
        order: 2,
        axes: ['IdentifierOfSiteTypedAxis'],
        repeating: true,
        applicabilityCause: sites,
      }),
    ];
    const entries = layOutStep(fields, new Set());
    expect([...notesByEntry({ entries, notes: applicabilityNotes(fields) }).keys()]).toEqual([1]);
  });
});

describe('undismissed', () => {
  const [note] = applicabilityNotes([
    field({ elementKey: 'SiteLocatedInABiodiversitySensitiveArea', applicabilityCause: sites }),
    field({ elementKey: 'AreaOfSiteInBiodiversitySensitiveArea', applicabilityCause: sites }),
  ]);
  const notes = note === undefined ? [] : [note];

  it('hides a note once every field it names is dismissed', () => {
    const dismissed = new Set(['SiteLocatedInABiodiversitySensitiveArea', 'AreaOfSiteInBiodiversitySensitiveArea']);
    expect(undismissed({ notes, dismissed })).toEqual([]);
  });

  it('keeps it while one field it names is not', () => {
    expect(undismissed({ notes, dismissed: new Set(['SiteLocatedInABiodiversitySensitiveArea']) })).toEqual(notes);
  });
});

describe('forgetNotAsked', () => {
  it('forgets the dismissal of a field read as not asked, so its note returns when the field does', () => {
    const dismissed = new Set(['EmployeeTurnoverRate', 'TotalWaterConsumption']);
    const fields = [
      field({ elementKey: 'EmployeeTurnoverRate', applicable: false }),
      field({ elementKey: 'TotalWaterConsumption' }),
    ];
    expect([...forgetNotAsked({ dismissed, fields })]).toEqual(['TotalWaterConsumption']);
  });

  it('answers the same set where nothing is forgotten, so the caller can skip a write', () => {
    const dismissed = new Set(['TotalWaterConsumption']);
    expect(forgetNotAsked({ dismissed, fields: [field({ elementKey: 'TotalWaterConsumption' })] })).toBe(dismissed);
  });
});
