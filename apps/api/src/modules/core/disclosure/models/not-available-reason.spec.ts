import { DISCLOSURE_STATE } from './disclosure-value.model';
import { NOT_AVAILABLE_REASON, notAvailableReasonVerdict } from './not-available-reason';

/** FR-32's pairing, at its edges (task 183): the store's CHECK, plus the blank reason the CHECK lets through. */
describe('notAvailableReasonVerdict (FR-32, task 183)', () => {
  it('accepts not available with a reason, and any other state with none', () => {
    expect(
      notAvailableReasonVerdict({ state: DISCLOSURE_STATE.NOT_AVAILABLE, notAvailableReason: 'Not collected.' }),
    ).toBe(NOT_AVAILABLE_REASON.MATCHES);
    expect(notAvailableReasonVerdict({ state: DISCLOSURE_STATE.OK, notAvailableReason: null })).toBe(
      NOT_AVAILABLE_REASON.MATCHES,
    );
  });

  it.each([null, '', '   ', '\t\n'])('refuses not available with the reason %j as missing', (reason) => {
    expect(notAvailableReasonVerdict({ state: DISCLOSURE_STATE.NOT_AVAILABLE, notAvailableReason: reason })).toBe(
      NOT_AVAILABLE_REASON.MISSING,
    );
  });

  it.each(['Not collected.', '', ' '])('refuses the reason %j on any other state as unexpected', (reason) => {
    for (const state of [DISCLOSURE_STATE.OK, DISCLOSURE_STATE.MISSING, DISCLOSURE_STATE.NIL_RETURN]) {
      expect(notAvailableReasonVerdict({ state, notAvailableReason: reason })).toBe(NOT_AVAILABLE_REASON.UNEXPECTED);
    }
  });
});
