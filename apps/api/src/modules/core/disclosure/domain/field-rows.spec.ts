import { rowsOf } from './field-rows';

/** Task 133.2: which rows a step shows for one element — §7.3's three shapes. */
const NONE = { repeating: false, members: [], classification: null, chosen: [], answeredOrdinals: [], defaultRows: 0 };

describe('rowsOf', () => {
  describe('a typed axis — a repeating group', () => {
    it('shows every ordinal the axis is answered at and every one the defaults offer, in order', () => {
      expect(rowsOf({ ...NONE, repeating: true, answeredOrdinals: [4, 1], defaultRows: 2 })).toEqual([
        { dimensionKey: '', ordinal: 0 },
        { dimensionKey: '', ordinal: 1 },
        { dimensionKey: '', ordinal: 4 },
      ]);
    });

    it('shows one empty row where nothing is answered or offered, so the group can be started', () => {
      expect(rowsOf({ ...NONE, repeating: true })).toEqual([{ dimensionKey: '', ordinal: 0 }]);
    });

    it('takes precedence over a member list, which a typed axis cannot have', () => {
      expect(rowsOf({ ...NONE, repeating: true, members: ['TotalMember'], answeredOrdinals: [1] })).toEqual([
        { dimensionKey: '', ordinal: 1 },
      ]);
    });
  });

  it('shows a breakdown’s every member, in the order given, at the first ordinal', () => {
    expect(rowsOf({ ...NONE, members: ['TotalMember', 'RenewableMember', 'NonRenewableMember'] })).toEqual([
      { dimensionKey: 'TotalMember', ordinal: 0 },
      { dimensionKey: 'RenewableMember', ordinal: 0 },
      { dimensionKey: 'NonRenewableMember', ordinal: 0 },
    ]);
  });

  describe('a classification', () => {
    it('shows the members chosen on the axis, not the ones it admits', () => {
      expect(
        rowsOf({ ...NONE, classification: 'TypeOfPollutantAxis', chosen: ['AmmoniaMember', 'MethaneMember'] }),
      ).toEqual([
        { dimensionKey: 'AmmoniaMember', ordinal: 0 },
        { dimensionKey: 'MethaneMember', ordinal: 0 },
      ]);
    });

    it('shows one unassigned row where nothing is chosen yet', () => {
      expect(rowsOf({ ...NONE, classification: 'TypeOfPollutantAxis' })).toEqual([{ dimensionKey: '', ordinal: 0 }]);
    });
  });

  it('shows anything else as one undimensioned row', () => {
    expect(rowsOf(NONE)).toEqual([{ dimensionKey: '', ordinal: 0 }]);
  });
});
