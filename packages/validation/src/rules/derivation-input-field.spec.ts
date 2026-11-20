import { describe, expect, it } from 'vitest';
import { derivationInputField, inputKeyOf, isDerivationInputField } from './derivation-input-field.js';

describe('derivationInputField', () => {
  it('pins the wire value a finding on an input carries, and the rule set names', () => {
    expect(derivationInputField('NumberOfEmployeesCoveredByCollectiveBargainingAgreements')).toBe(
      'input:NumberOfEmployeesCoveredByCollectiveBargainingAgreements',
    );
  });
});

describe('isDerivationInputField', () => {
  it('is true of an input’s field', () => {
    expect(isDerivationInputField('input:HoursWorkedByOneFullTimeEmployee')).toBe(true);
  });

  it('is false of a disclosure element, of the entity’s IDNO, and of the bare prefix', () => {
    expect(isDerivationInputField('NumberOfEmployees')).toBe(false);
    expect(isDerivationInputField('entity:idno')).toBe(false);
    expect(isDerivationInputField('input:')).toBe(false);
  });
});

describe('inputKeyOf', () => {
  it('answers the input’s own key, and is the inverse of derivationInputField', () => {
    expect(inputKeyOf(derivationInputField('NumberOfMaleEmployeesAtManagementLevel'))).toBe(
      'NumberOfMaleEmployeesAtManagementLevel',
    );
  });

  it('answers null for any other field', () => {
    expect(inputKeyOf('NumberOfEmployees')).toBeNull();
    expect(inputKeyOf('entity:idno')).toBeNull();
  });
});
