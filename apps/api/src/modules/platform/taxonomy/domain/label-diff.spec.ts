import { labelDiff } from './label-diff';

describe('labelDiff (task 67.6)', () => {
  it('names each label added, removed or reworded between two versions, and nothing unchanged', () => {
    expect(
      labelDiff({
        before: { Kept: { text: 'Same' }, Reworded: { text: 'Old' }, Gone: { text: 'Bye' } },
        after: { Kept: { text: 'Same' }, Reworded: { text: 'New' }, Arrived: { text: 'Hi' } },
      }),
    ).toEqual([
      { element: 'Arrived', change: 'added', before: null, after: 'Hi' },
      { element: 'Gone', change: 'removed', before: 'Bye', after: null },
      { element: 'Reworded', change: 'changed', before: 'Old', after: 'New' },
    ]);
  });
});
