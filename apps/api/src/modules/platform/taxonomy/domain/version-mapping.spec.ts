import {
  COMPATIBILITY,
  FIELD_CHANGE,
  mappingScope,
  readVersionMapping,
  structuralChanges,
  versionMappingRefusal,
} from './version-mapping';

const mapping = (overrides: Record<string, unknown> = {}) => ({
  from: '2026-02-01',
  to: '2026-05-01',
  determination: COMPATIBILITY.COMPATIBLE,
  fields: [{ element: 'NewDisclosure', change: FIELD_CHANGE.ADDED }],
  ...overrides,
});

describe('a version pair’s mapping and determination (tasks 67.17, 67.21; 182/39, 182/40)', () => {
  it('reads a mapping whose determination its fields admit', () => {
    expect(readVersionMapping(mapping())).toEqual(mapping());
    expect(versionMappingRefusal(mapping())).toBeNull();
  });

  it('refuses a compatible pair that removes or alters a field, and admits it breaking', () => {
    for (const change of [FIELD_CHANGE.REMOVED, FIELD_CHANGE.ALTERED]) {
      const fields = [{ element: 'Turnover', change }];
      expect(versionMappingRefusal(mapping({ fields }))).toMatch(/compatible while it removes or alters/u);
      expect(versionMappingRefusal(mapping({ fields, determination: COMPATIBILITY.BREAKING }))).toBeNull();
    }
  });

  it('refuses a pair mapped backwards, an element mapped twice, and an unknown kind of change', () => {
    expect(versionMappingRefusal(mapping({ from: '2026-05-01', to: '2026-02-01' }))).not.toBeNull();
    expect(
      versionMappingRefusal(mapping({ fields: [{ element: 'A', change: 'added' }, { element: 'A', change: 'added' }] })),
    ).toMatch(/mapped twice/u);
    expect(versionMappingRefusal(mapping({ fields: [{ element: 'A', change: 'renamed' }] }))).not.toBeNull();
  });

  it('names the pair’s store scope from its two versions', () => {
    expect(mappingScope({ from: '2026-02-01', to: '2026-05-01' })).toBe('2026-02-01_2026-05-01');
  });

  it('proposes the structural changes between two element tables, sorted by element', () => {
    expect(
      structuralChanges({
        from: { Kept: { kind: 'text' }, Gone: { kind: 'text' }, Retyped: { kind: 'text' } },
        to: { Kept: { kind: 'text' }, Retyped: { kind: 'decimal' }, Arrived: { kind: 'text' } },
      }),
    ).toEqual([
      { element: 'Arrived', change: FIELD_CHANGE.ADDED },
      { element: 'Gone', change: FIELD_CHANGE.REMOVED },
      { element: 'Retyped', change: FIELD_CHANGE.ALTERED },
    ]);
  });
});
