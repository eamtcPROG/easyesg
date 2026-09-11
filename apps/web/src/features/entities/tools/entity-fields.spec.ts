import type { ReportingEntity } from '@easyesg/contracts';
import { describe, expect, it } from 'vitest';
import { CONSOLIDATION_BASIS, ENTITY_STANDING } from './entities';
import { EMPTY_MEMBER, EMPTY_SITE, toFields, toRequest } from './entity-fields';

const entity = (over: Partial<ReportingEntity>): ReportingEntity => ({
  id: 'e1',
  name: 'Brutăria',
  legalForm: 'srl',
  naceCodes: [],
  status: ENTITY_STANDING.ACTIVE,
  archivedAt: null,
  consolidationBasis: null,
  consolidationMembers: [],
  sites: [],
  createdAt: 1_788_000_000_000,
  updatedAt: 1_788_000_000_000,
  ...over,
});

describe('toFields', () => {
  it('seeds an empty form for a record that does not exist yet', () => {
    expect(toFields(null)).toEqual({
      name: '',
      legalForm: '',
      consolidationBasis: '',
      sites: [],
      consolidationMembers: [],
    });
  });

  it('turns a stored null into an empty field and keeps the id a save will need', () => {
    const fields = toFields(
      entity({
        consolidationBasis: CONSOLIDATION_BASIS.CONSOLIDATED,
        sites: [
          {
            id: 's1',
            name: 'Sediu',
            addressLine1: 'Str. Ștefan cel Mare 1',
            locality: null,
            postalCode: null,
            countryCode: null,
            latitude: null,
            longitude: null,
          },
        ],
        consolidationMembers: [{ id: 'm1', name: 'Filiala', idno: null, lei: null, countryCode: 'MD' }],
      }),
    );
    expect(fields.consolidationBasis).toBe(CONSOLIDATION_BASIS.CONSOLIDATED);
    expect(fields.sites).toEqual([
      { id: 's1', name: 'Sediu', addressLine1: 'Str. Ștefan cel Mare 1', locality: '', postalCode: '' },
    ]);
    expect(fields.consolidationMembers).toEqual([
      { id: 'm1', name: 'Filiala', idno: '', countryCode: 'MD' },
    ]);
  });
});

describe('toRequest', () => {
  it('trims, sends a blank as null, drops the id of a new row and keeps a stored one', () => {
    const request = toRequest(
      {
        name: '  Brutăria ',
        legalForm: '',
        consolidationBasis: '',
        sites: [{ ...EMPTY_SITE, name: 'Sediu ' }],
        consolidationMembers: [{ ...EMPTY_MEMBER, id: 'm1', name: 'Filiala' }],
      },
      [{ code: '10.71', label: 'Fabricarea pâinii' }],
    );
    expect(request).toEqual({
      name: 'Brutăria',
      legalForm: null,
      naceCodes: ['10.71'],
      consolidationBasis: null,
      sites: [{ name: 'Sediu', addressLine1: null, locality: null, postalCode: null }],
      consolidationMembers: [{ id: 'm1', name: 'Filiala', idno: null, countryCode: null }],
    });
  });

  it('sends a stated basis as itself', () => {
    const request = toRequest(
      { name: 'B', legalForm: 'srl', consolidationBasis: CONSOLIDATION_BASIS.INDIVIDUAL, sites: [], consolidationMembers: [] },
      [],
    );
    expect(request.consolidationBasis).toBe(CONSOLIDATION_BASIS.INDIVIDUAL);
    expect(request.legalForm).toBe('srl');
  });
});
