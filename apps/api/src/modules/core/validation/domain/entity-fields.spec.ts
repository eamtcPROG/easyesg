import { ENTITY_FIELD } from '@easyesg/validation';
import { VSME_TAXONOMY_CONFIG_KIND } from '@api/modules/platform/taxonomy/constants/taxonomy.constants';
import { readSeedEntries } from '@api/testing/seed-configuration-store';
import { entityFieldValues, withEntityFields } from './entity-fields';

/** Task 210 (FR-16 behaviour 6; §12.5.6's task-210 row (1), (g)): the entity's record answers a field a rule may read. */
describe('withEntityFields', () => {
  const scope = new Map<string, readonly string[]>([
    ['Turnover', ['B1']],
    ['NumberOfEmployees', ['B1', 'C5']],
  ]);

  it('places the IDNO in B1, beside every element already in scope', () => {
    expect(withEntityFields({ scope, modules: ['B1', 'B2', 'C5'] })).toEqual(
      new Map([...scope, [ENTITY_FIELD.IDNO, ['B1']]]),
    );
  });

  it('leaves a scope whose report lists no B1 as it is — a field counted in no module would disagree with the report', () => {
    expect(withEntityFields({ scope, modules: ['B2'] })).toBe(scope);
  });

  it('places nothing in a scope it was handed, which the wizard’s reads may share', () => {
    withEntityFields({ scope, modules: ['B1'] });
    expect(scope.has(ENTITY_FIELD.IDNO)).toBe(false);
  });
});

describe('entityFieldValues', () => {
  it('answers the IDNO the entity holds, at the field’s one address', () => {
    expect(entityFieldValues({ idno: '1003600005148' })).toEqual([
      { elementKey: 'entity:idno', dimensionKey: '', ordinal: 0, valueText: '1003600005148' },
    ]);
  });

  it('answers nothing where the entity holds none, so a rule requiring it finds it missing', () => {
    expect(entityFieldValues({ idno: null })).toEqual([]);
  });
});

describe('an entity field’s key', () => {
  it('is no element’s key in any taxonomy version the seed registers, so the two cannot be confused', () => {
    const versions = readSeedEntries().filter((entry) => entry.kind === VSME_TAXONOMY_CONFIG_KIND);
    expect(versions.length).toBeGreaterThan(0);
    for (const version of versions) {
      const elements = Object.keys((version.payload as { readonly elements: Record<string, unknown> }).elements);
      expect(elements.length).toBeGreaterThan(0);
      for (const key of Object.values(ENTITY_FIELD)) expect(elements).not.toContain(key);
    }
  });
});
