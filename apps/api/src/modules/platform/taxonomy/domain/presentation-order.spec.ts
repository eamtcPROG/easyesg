import { presentationOrder } from './presentation-order';

/** The standard's presentation order (task 79.6) — the shapes that `order` alone got wrong, each a case. */
describe('presentationOrder', () => {
  const element = (key: string, over: { modules?: string[]; section?: string; order: number; parent?: string }) => ({
    key,
    modules: over.modules ?? ['C8'],
    section: over.section ?? '[1380] C8 - Governance - Revenues derived from activities',
    order: over.order,
    parent: over.parent ?? 'RevenuesDerivedFromActivitiesAbstract',
  });
  const sorted = (elements: ReturnType<typeof element>[], modules = ['B1', 'B3', 'C3', 'C6', 'C8']) =>
    [...elements].sort(presentationOrder({ elements, modules })).map((entry) => entry.key);

  it('puts an element after the element it belongs to — C8’s three fossil revenues under their total', () => {
    expect(
      sorted([
        element('Gas', { order: 3, parent: 'Total' }),
        element('Coal', { order: 1, parent: 'Total' }),
        element('Weapons', { order: 1 }),
        element('Total', { order: 3 }),
        element('Oil', { order: 2, parent: 'Total' }),
        element('Chemicals', { order: 4 }),
        element('Tobacco', { order: 2 }),
      ]),
    ).toEqual(['Weapons', 'Tobacco', 'Total', 'Coal', 'Oil', 'Gas', 'Chemicals']);
  });

  it('keeps a section together, in its code’s order — C8’s exclusion after its revenues', () => {
    expect(
      sorted([
        element('Exclusion', { order: 1, section: '[1390] C8 - Governance - Exclusion from EU benchmarks', parent: 'X' }),
        element('Weapons', { order: 1 }),
        element('Tobacco', { order: 2 }),
      ]),
    ).toEqual(['Weapons', 'Tobacco', 'Exclusion']);
  });

  it('reads the February version’s codes too, and a section with no code by its whole name', () => {
    expect(
      sorted([
        element('Later', { order: 1, section: '[C08.100] - Governance - Exclusion' }),
        element('Earlier', { order: 9, section: '[C08.000] - Governance - Revenues' }),
      ]),
    ).toEqual(['Earlier', 'Later']);
    expect(sorted([element('B', { order: 1, section: 'Beta' }), element('A', { order: 2, section: 'Alpha' })])).toEqual([
      'A',
      'B',
    ]);
  });

  it('orders by module first, an element in two by its first, and an unmoduled one last', () => {
    expect(
      sorted([
        element('CatchAll', { modules: [], order: 1, section: '[0001]' }),
        element('C6Only', { modules: ['C6'], order: 1, section: '[0001]' }),
        element('Shared', { modules: ['B3', 'C3'], order: 5, section: '[9999]' }),
        element('B1Only', { modules: ['B1'], order: 9, section: '[9999]' }),
      ]),
    ).toEqual(['B1Only', 'Shared', 'C6Only', 'CatchAll']);
  });

  it('survives a parent cycle a hand-edited artefact could hold', () => {
    expect(
      sorted([element('A', { order: 2, parent: 'B' }), element('B', { order: 1, parent: 'A' })]).sort(),
    ).toEqual(['A', 'B']);
  });
});
