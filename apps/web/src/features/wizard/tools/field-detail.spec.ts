import { describe, expect, it } from 'vitest';
import { FIELD_DETAIL, fieldDetail } from './field-detail';

/** Telling a finding's field from its siblings (task 42.2). */
const COUNTRIES = { MD: 'Republica Moldova' };

describe('fieldDetail', () => {
  it('names a member by the read’s label first, then a country by this app’s own name', () => {
    expect(fieldDetail({ field: { dimensionKey: 'RenewableEnergyMember', ordinal: 0, memberLabel: 'Regenerabilă' }, countries: COUNTRIES })).toEqual({
      kind: FIELD_DETAIL.MEMBER,
      label: 'Regenerabilă',
    });
    expect(fieldDetail({ field: { dimensionKey: 'MD', ordinal: 0, memberLabel: null }, countries: COUNTRIES })).toEqual({
      kind: FIELD_DETAIL.MEMBER,
      label: 'Republica Moldova',
    });
  });

  it('names a later row of a repeating group by its position, and says nothing of a first or single row', () => {
    expect(fieldDetail({ field: { dimensionKey: '', ordinal: 1, memberLabel: null }, countries: COUNTRIES })).toEqual({
      kind: FIELD_DETAIL.ROW,
      position: 2,
    });
    expect(fieldDetail({ field: { dimensionKey: '', ordinal: 0, memberLabel: null }, countries: COUNTRIES })).toBeNull();
  });

  it('never shows an unnamed member’s key', () => {
    expect(fieldDetail({ field: { dimensionKey: 'SomeAxisMember', ordinal: 0, memberLabel: null }, countries: COUNTRIES })).toBeNull();
  });
});
