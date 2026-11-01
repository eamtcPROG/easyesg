import { describe, expect, it } from 'vitest';
import { ENTITY_FIELD, isEntityField } from './entity-field.js';

describe('ENTITY_FIELD', () => {
  it('pins the wire value a finding on the entity’s IDNO carries, and a kept rule set names', () => {
    expect(ENTITY_FIELD.IDNO).toBe('entity:idno');
  });

  it('keys every field with a prefix, which no taxonomy element’s bare name can carry', () => {
    for (const key of Object.values(ENTITY_FIELD)) expect(key).toMatch(/^entity:/u);
  });
});

describe('isEntityField', () => {
  it('is true of a field the entity’s record answers', () => {
    expect(isEntityField('entity:idno')).toBe(true);
  });

  it('is false of a disclosure element, and of a near miss', () => {
    expect(isEntityField('NumberOfEmployees')).toBe(false);
    expect(isEntityField('entity:lei')).toBe(false);
    expect(isEntityField('idno')).toBe(false);
  });
});
