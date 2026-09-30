import type { ReportingEntity } from '@easyesg/contracts';
import { describe, expect, it } from 'vitest';
import { CONSOLIDATION_BASIS, ENTITY_STANDING } from './entities';
import { EMPTY_MEMBER, EMPTY_SITE, toFields, toRequest } from './entity-fields';

const entity = (over: Partial<ReportingEntity>): ReportingEntity => ({
  id: 'e1',
  name: 'Brutăria',
  legalForm: 'srl',
  idno: null,
  lei: null,
  registeredAddressLine1: null,
  registeredAddressLine2: null,
  registeredLocality: null,
  registeredPostalCode: null,
  reportContactName: null,
  reportContactEmail: null,
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
      idno: '',
      lei: '',
      registeredAddressLine1: '',
      registeredAddressLine2: '',
      registeredLocality: '',
      registeredPostalCode: '',
      reportContactName: '',
      reportContactEmail: '',
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
      {
        id: 's1',
        name: 'Sediu',
        addressLine1: 'Str. Ștefan cel Mare 1',
        locality: '',
        postalCode: '',
        countryCode: '',
        coordinates: '',
        removed: false,
      },
    ]);
    expect(fields.consolidationMembers).toEqual([
      { id: 'm1', name: 'Filiala', idno: '', lei: '', countryCode: 'MD', removed: false },
    ]);
  });

  it('holds the entity’s identifiers, a stored null as an empty field (task 175)', () => {
    expect(toFields(entity({ idno: '1003600158022', lei: null }))).toMatchObject({ idno: '1003600158022', lei: '' });
  });
});

describe('toRequest', () => {
  it('trims, sends a blank as null, drops the id of a new row and keeps a stored one', () => {
    const request = toRequest(
      {
        name: '  Brutăria ',
        legalForm: '',
        idno: '',
        lei: '',
        registeredAddressLine1: '',
        registeredAddressLine2: '',
        registeredLocality: '',
        registeredPostalCode: '',
        reportContactName: '',
        reportContactEmail: '',
        consolidationBasis: '',
        sites: [{ ...EMPTY_SITE, name: 'Sediu ' }],
        consolidationMembers: [{ ...EMPTY_MEMBER, id: 'm1', name: 'Filiala' }],
      },
      [{ code: '10.71', label: 'Fabricarea pâinii' }],
    );
    // Strict, so a `{ id: undefined }` on the new row — which `toEqual` would forgive — fails the
    // name of this case: the row is sent *without* an id, not with an empty one.
    expect(request).toStrictEqual({
      name: 'Brutăria',
      legalForm: null,
      idno: null,
      lei: null,
      registeredAddressLine1: null,
      registeredAddressLine2: null,
      registeredLocality: null,
      registeredPostalCode: null,
      reportContactName: null,
      reportContactEmail: null,
      naceCodes: ['10.71'],
      consolidationBasis: null,
      sites: [
        {
          name: 'Sediu',
          addressLine1: null,
          locality: null,
          postalCode: null,
          countryCode: null,
          latitude: null,
          longitude: null,
        },
      ],
      consolidationMembers: [{ id: 'm1', name: 'Filiala', idno: null, lei: null, countryCode: null }],
    });
  });

  it('sends back every column a stored row holds, so a save clears nothing the form does not show (task 180.1)', () => {
    // The wipe this case exists for: the api replaces a row whole and maps an absent field to null, so a site's country
    // and coordinates, and a subsidiary's LEI, used to be cleared by every save of the record.
    const stored = entity({
      sites: [
        {
          id: 's1',
          name: 'Sediu',
          addressLine1: 'Str. Ștefan cel Mare 1',
          locality: 'Chișinău',
          postalCode: 'MD-2012',
          countryCode: 'MD',
          latitude: '47.024512',
          longitude: '28.832363',
        },
      ],
      consolidationMembers: [{ id: 'm1', name: 'Filiala', idno: null, lei: '7LTWFZYICNSX8D621K86', countryCode: 'MD' }],
    });

    const request = toRequest(toFields(stored), []);

    expect(request.sites).toStrictEqual([
      {
        id: 's1',
        name: 'Sediu',
        addressLine1: 'Str. Ștefan cel Mare 1',
        locality: 'Chișinău',
        postalCode: 'MD-2012',
        countryCode: 'MD',
        latitude: '47.024512',
        longitude: '28.832363',
      },
    ]);
    expect(request.consolidationMembers?.[0]).toMatchObject({ lei: '7LTWFZYICNSX8D621K86', countryCode: 'MD' });
  });

  it('sends the coordinates as the api’s two strings, and none where the field is empty', () => {
    const fields = toFields(entity({}));
    const request = toRequest(
      {
        ...fields,
        sites: [
          { ...EMPTY_SITE, name: 'Hala', coordinates: '47,0105; 28,8638' },
          { ...EMPTY_SITE, name: 'Depozit', coordinates: '' },
        ],
      },
      [],
    );

    expect(request.sites?.map((site) => [site.latitude, site.longitude])).toEqual([
      ['47.0105', '28.8638'],
      [null, null],
    ]);
  });

  it('leaves a removed row out, so the whole-collection save deletes it', () => {
    // 28 Sep 2026: removing a stored row marks it, and the store forgets it only on the save — the API's semantics
    // make an omitted stored row a removed one.
    const request = toRequest(
      {
        name: 'B',
        legalForm: '',
        idno: '',
        lei: '',
        registeredAddressLine1: '',
        registeredAddressLine2: '',
        registeredLocality: '',
        registeredPostalCode: '',
        reportContactName: '',
        reportContactEmail: '',
        consolidationBasis: CONSOLIDATION_BASIS.CONSOLIDATED,
        sites: [
          { ...EMPTY_SITE, id: 's1', name: 'Depozit', removed: true },
          { ...EMPTY_SITE, id: 's2', name: 'Sediu' },
        ],
        consolidationMembers: [
          { ...EMPTY_MEMBER, id: 'm1', name: 'Filiala veche', removed: true },
          { ...EMPTY_MEMBER, id: 'm2', name: 'Filiala nouă' },
        ],
      },
      [],
    );
    expect(request.sites?.map((site) => site.id)).toEqual(['s2']);
    expect(request.consolidationMembers?.map((member) => member.id)).toEqual(['m2']);
  });

  it('sends the identifiers trimmed, the LEI upper-cased, and a cleared one as null (task 175)', () => {
    const fields = toFields(entity({}));
    const typed = toRequest({ ...fields, idno: ' 1003600158022 ', lei: '7ltwfzyicnsx8d621k86 ' }, []);
    expect({ idno: typed.idno, lei: typed.lei }).toEqual({ idno: '1003600158022', lei: '7LTWFZYICNSX8D621K86' });

    // `null` is what clears a stored identifier on the API, and `''` is what a cleared field holds.
    const cleared = toRequest({ ...fields, idno: '', lei: '  ' }, []);
    expect({ idno: cleared.idno, lei: cleared.lei }).toEqual({ idno: null, lei: null });
  });

  it('sends the registered address and the report contact trimmed, a cleared one as null (task 177)', () => {
    const fields = toFields(
      entity({ registeredLocality: 'Chișinău', reportContactName: 'Ana Rusu', reportContactEmail: 'ana@lina.md' }),
    );
    expect(fields).toMatchObject({ registeredLocality: 'Chișinău', registeredAddressLine1: '', reportContactName: 'Ana Rusu' });

    const request = toRequest(
      { ...fields, registeredAddressLine1: ' str. Ștefan cel Mare 1 ', reportContactEmail: '  ' },
      [],
    );
    expect(request).toMatchObject({
      registeredAddressLine1: 'str. Ștefan cel Mare 1',
      registeredAddressLine2: null,
      registeredLocality: 'Chișinău',
      reportContactName: 'Ana Rusu',
      reportContactEmail: null,
    });
  });

  it('sends a stated basis as itself', () => {
    const request = toRequest(
      {
        name: 'B',
        legalForm: 'srl',
        idno: '',
        lei: '',
        registeredAddressLine1: '',
        registeredAddressLine2: '',
        registeredLocality: '',
        registeredPostalCode: '',
        reportContactName: '',
        reportContactEmail: '',
        consolidationBasis: CONSOLIDATION_BASIS.INDIVIDUAL,
        sites: [],
        consolidationMembers: [],
      },
      [],
    );
    expect(request.consolidationBasis).toBe(CONSOLIDATION_BASIS.INDIVIDUAL);
    expect(request.legalForm).toBe('srl');
  });
});
