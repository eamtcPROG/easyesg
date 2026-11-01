import { describe, expect, it } from 'vitest';
import { HISTORY_SUBJECT, historyPath } from './history-subject';

const FIELD = {
  kind: HISTORY_SUBJECT.VALUE,
  reportId: 'r 1',
  elementKey: 'NumberOfEmployees',
  dimensionKey: '',
  ordinal: 0,
} as const;

/** S-12's addresses (task 84.2): each subject's history through the pass-through, a field's element in the path. */
describe('historyPath', () => {
  it('addresses each subject, and a field’s dimension and position only where they are not the defaults', () => {
    expect(historyPath({ kind: HISTORY_SUBJECT.ORGANIZATION })).toBe('/api/v1/organization/history');
    expect(historyPath({ kind: HISTORY_SUBJECT.ENTITY, entityId: 'e-1' })).toBe('/api/v1/entities/e-1/history');
    expect(historyPath(FIELD)).toBe('/api/v1/reports/r%201/values/NumberOfEmployees/history');
    expect(historyPath({ ...FIELD, dimensionKey: 'Female Member', ordinal: 2 })).toBe(
      '/api/v1/reports/r%201/values/NumberOfEmployees/history?dimensionKey=Female+Member&ordinal=2',
    );
  });
});
