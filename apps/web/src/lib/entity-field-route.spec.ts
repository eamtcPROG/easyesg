import { describe, expect, it } from 'vitest';
import { ENTITY_FIELD } from '@easyesg/validation';
import { ENTITY_FIELD_ANCHOR, entityFieldLandedOn, entityFieldRoute } from './entity-field-route';

/** Task 210 (§12.5.6's task-210 row (2)): a finding on the entity's IDNO leads to S-13's record, at the field. */
describe('entityFieldRoute', () => {
  it('is the entity’s record, at the field’s anchor', () => {
    expect(entityFieldRoute({ entityId: 'e-1', field: ENTITY_FIELD.IDNO })).toBe('/entities/e-1#entity-idno');
  });
});

describe('entityFieldLandedOn', () => {
  it('reads the field back from the fragment the route carries, with or without its hash', () => {
    expect(entityFieldLandedOn('#entity-idno')).toBe(ENTITY_FIELD.IDNO);
    expect(entityFieldLandedOn('entity-idno')).toBe(ENTITY_FIELD.IDNO);
  });

  it('lands on nothing for a fragment that names no field, or none', () => {
    expect(entityFieldLandedOn('#identity')).toBeNull();
    expect(entityFieldLandedOn('')).toBeNull();
  });

  it('gives every field an anchor of its own, so no two land on one', () => {
    const anchors = Object.values(ENTITY_FIELD_ANCHOR);
    expect(new Set(anchors).size).toBe(Object.values(ENTITY_FIELD).length);
  });
});
