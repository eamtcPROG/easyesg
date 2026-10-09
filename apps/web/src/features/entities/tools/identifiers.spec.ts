import { describe, expect, it } from 'vitest';
import { IDENTIFIER_FAULT, idnoFault, leiFault } from './identifiers';

describe('idnoFault', () => {
  it.each(['1003600005148', '1017600033216'])('finds nothing wrong with the published IDNO %s', (idno) => {
    expect(idnoFault(idno)).toBeNull();
  });

  it('finds nothing wrong with a blank field, which clears the IDNO', () => {
    expect(idnoFault('   ')).toBeNull();
  });

  it('reads the value as the api will, without the spaces around it', () => {
    expect(idnoFault(' 1003600005148 ')).toBeNull();
  });

  // Pinned as the wire values the component branches on: a rename must break here, not silently pick the other sentence.
  it('calls a value that is not thirteen digits malformed', () => {
    expect(idnoFault('100360000514')).toBe('malformed');
    expect(idnoFault('10036000051X8')).toBe(IDENTIFIER_FAULT.MALFORMED);
  });

  it('calls thirteen digits whose last disagrees with the twelve before it a check-digit fault', () => {
    // A published IDNO with its last digit mutated, so the shape passes and only the check digit sees it.
    expect(idnoFault('1003600005149')).toBe('check_digits');
  });
});

describe('leiFault', () => {
  it('finds nothing wrong with a published LEI, typed in lower case, since the save upper-cases it', () => {
    expect(leiFault('7ltwfzyicnsx8d621k86')).toBeNull();
  });

  it('finds nothing wrong with a blank field', () => {
    expect(leiFault('')).toBeNull();
  });

  it('tells a malformed LEI from one whose check digits disagree', () => {
    expect(leiFault('NOT-A-LEI')).toBe(IDENTIFIER_FAULT.MALFORMED);
    expect(leiFault('7LTWFZYICNSX8D621K00')).toBe(IDENTIFIER_FAULT.CHECK_DIGITS);
  });
});
