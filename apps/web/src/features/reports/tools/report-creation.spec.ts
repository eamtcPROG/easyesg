import { describe, expect, it } from 'vitest';
import { ENTITY_STATUS, type ReportingEntity } from '@easyesg/contracts';
import { creationChoice, creationEntities } from './report-creation';

describe('creationChoice', () => {
  it('reads both choices from the address', () => {
    expect(creationChoice({ entity: 'e1', period: 'p1' })).toEqual({ entityId: 'e1', periodId: 'p1' });
  });

  it('answers undefined for a choice not yet made', () => {
    expect(creationChoice({})).toEqual({ entityId: undefined, periodId: undefined });
  });

  it('takes the first value of a repeated key', () => {
    expect(creationChoice({ entity: ['e1', 'e2'] })).toEqual({ entityId: 'e1', periodId: undefined });
  });
});

/** FR-20 and §12.5.6's task-187 row: the entities S-39 offers, and the address's choice as the screen honours it. */
describe('creationEntities', () => {
  const anEntity = (over: Partial<ReportingEntity>): ReportingEntity =>
    ({ id: 'e1', name: 'Alfa SRL', status: ENTITY_STATUS.ACTIVE, ...over }) as ReportingEntity;
  const ENTITIES = [
    anEntity({ id: 'e2', name: 'Gama SA' }),
    anEntity({ id: 'e3', name: 'Beta SRL', status: ENTITY_STATUS.ARCHIVED }),
    anEntity({ id: 'e1', name: 'Alfa SRL' }),
  ];

  it('offers the active entities only, by name', () => {
    expect(creationEntities({ entities: ENTITIES }).entities).toEqual([
      { id: 'e1', name: 'Alfa SRL' },
      { id: 'e2', name: 'Gama SA' },
    ]);
  });

  it('keeps a choice it offers, and reads an archived or unknown entity as no choice made', () => {
    expect(creationEntities({ entities: ENTITIES, entityId: 'e2' }).entityId).toBe('e2');
    expect(creationEntities({ entities: ENTITIES, entityId: 'e3' }).entityId).toBeUndefined();
    expect(creationEntities({ entities: ENTITIES, entityId: 'nobody' }).entityId).toBeUndefined();
    expect(creationEntities({ entities: ENTITIES }).entityId).toBeUndefined();
  });
});
