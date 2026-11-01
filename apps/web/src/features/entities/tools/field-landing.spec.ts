import { describe, expect, it } from 'vitest';
import { landingInput } from './field-landing';

/** Task 210 (FR-42 behaviour 6): a finding on the entity's IDNO opens S-13's record with focus in the IDNO's input. */
describe('landingInput', () => {
  it('is the IDNO’s input for the fragment a finding on it carries', () => {
    expect(landingInput('#entity-idno')).toBe('idno');
  });

  it('is none for an address that names no field, or a section', () => {
    expect(landingInput('')).toBeNull();
    expect(landingInput('#identity')).toBeNull();
  });
});
