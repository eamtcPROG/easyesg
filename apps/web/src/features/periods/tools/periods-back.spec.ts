import { describe, expect, it } from 'vitest';
import { periodsBack } from './periods-back';

/** S-14's arrow (30 Sep 2026): back to where the reader came from, and up to the entity when nothing says. */
describe('periodsBack', () => {
  it('returns to the list of entities, the entity, or the new report with the entity still chosen', () => {
    expect(periodsBack({ entityId: 'e1', from: 'entities' })).toEqual({ href: '/entities', to: 'entities' });
    expect(periodsBack({ entityId: 'e1', from: 'entity' })).toEqual({ href: '/entities/e1', to: 'entity' });
    expect(periodsBack({ entityId: 'e1', from: 'new-report' })).toEqual({
      href: '/reports/new?entity=e1',
      to: 'new-report',
    });
  });

  it('leads up to the entity when the address names no origin', () => {
    expect(periodsBack({ entityId: 'e1', from: null })).toEqual({ href: '/entities/e1', to: 'entity' });
  });
});
