import { describe, expect, it } from 'vitest';
import { unsubscribeView } from './unsubscribe';

/** S-38's four arms (task 52.2.2), from the api's standing — literals on purpose: they are the wire values. */
describe('unsubscribeView', () => {
  it('offers the switch while the link can still switch the category off', () => {
    expect(
      unsubscribeView({ standing: 'available', categoryKey: 'reporting.manual_reminder', categoryName: 'Mementouri' }),
    ).toEqual({ kind: 'confirm', categoryName: 'Mementouri' });
  });

  it('says it is already off, and words a category with no name written without one', () => {
    expect(unsubscribeView({ standing: 'switched_off', categoryKey: 'reporting.manual_reminder' })).toEqual({
      kind: 'switched_off',
      categoryName: null,
    });
  });

  it('draws an unusable link as unusable, naming nothing', () => {
    expect(unsubscribeView({ standing: 'unusable' })).toEqual({ kind: 'unusable' });
  });

  it('draws a read that got no answer as unreachable', () => {
    expect(unsubscribeView(null)).toEqual({ kind: 'unreachable' });
  });
});
