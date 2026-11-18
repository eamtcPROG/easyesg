import { describe, expect, it } from 'vitest';
import { MAPPING_EVENT, determinationAdmitted, mappedFields, mappingReducer, type MappingDraft } from './mapping-draft';

const COMPATIBLE: MappingDraft = { determination: 'compatible', fields: [] };

describe('a pair’s mapping as A-04 edits it (task 67.6)', () => {
  it('loads a stored mapping or a proposal whole', () => {
    const loaded = mappingReducer(COMPATIBLE, {
      type: MAPPING_EVENT.LOADED,
      mapping: { determination: 'breaking', fields: [{ element: 'Turnover', change: 'altered' }] },
    });
    expect(loaded).toEqual({ determination: 'breaking', fields: [{ element: 'Turnover', change: 'altered' }] });
  });

  it('makes the pair breaking the moment a field is removed or altered, and keeps it so (182/40)', () => {
    const added = mappingReducer(COMPATIBLE, { type: MAPPING_EVENT.FIELD_ADDED });
    expect(added.determination).toBe('compatible');
    const altered = mappingReducer(added, {
      type: MAPPING_EVENT.FIELD_CHANGED,
      index: 0,
      field: { element: 'Turnover', change: 'altered' },
    });
    expect(altered.determination).toBe('breaking');
    expect(mappingReducer(altered, { type: MAPPING_EVENT.DETERMINATION_CHOSEN, determination: 'compatible' }).determination).toBe(
      'breaking',
    );
  });

  it('lets a pair that only adds be either, the operator’s to say', () => {
    const breaking = mappingReducer(COMPATIBLE, { type: MAPPING_EVENT.DETERMINATION_CHOSEN, determination: 'breaking' });
    expect(breaking.determination).toBe('breaking');
    expect(determinationAdmitted({ determination: 'compatible', fields: [{ element: 'X', change: 'added' }] })).toBe(true);
  });

  it('sends only the rows that name an element, trimmed, and drops a removed row', () => {
    const draft: MappingDraft = {
      determination: 'breaking',
      fields: [
        { element: ' Turnover ', change: 'altered' },
        { element: '  ', change: 'added' },
      ],
    };
    expect(mappedFields(draft)).toEqual([{ element: 'Turnover', change: 'altered' }]);
    expect(mappingReducer(draft, { type: MAPPING_EVENT.FIELD_REMOVED, index: 0 }).fields).toHaveLength(1);
  });
});
