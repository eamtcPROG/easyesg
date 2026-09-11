import { describe, expect, it } from 'vitest';
import type { Organization } from '@easyesg/contracts';
import { toFields, toPatch, type ProfileFields } from './profile-fields';

/**
 * The one invariant this pair carries: **`''` and `null` are the same absence, and they round-trip**
 * (task 129). Before the split both directions sat inside the form — `toFields` as a module constant,
 * the patch as an object literal built inside the submit handler — so this could only be exercised by
 * driving a browser through thirteen fields.
 *
 * **Asserted over the whole object, never field by field.** The failure mode here is one field
 * forgotten in one direction: a `??` missing from `toFields` renders `null` into an input, and an
 * `orNull` missing from `toPatch` sends `''` to an API that accepts it for nothing. A spec naming
 * three fields would pass with the other ten wrong, which is the shape the thirteen-way repetition
 * invites.
 */
const stored = (over: Partial<Organization> = {}): Organization =>
  ({
    id: 'org-1',
    name: 'Brutăria',
    countryCode: 'MD',
    legalForm: null,
    idno: null,
    lei: null,
    registeredAddressLine1: null,
    registeredAddressLine2: null,
    registeredLocality: null,
    registeredPostalCode: null,
    contactEmail: null,
    contactPhone: null,
    reportContactName: null,
    reportContactEmail: null,
    lastChange: null,
    ...over,
  }) as unknown as Organization;

describe('toFields', () => {
  it('turns every absence into the empty string an input can hold', () => {
    const fields = toFields(stored());

    // Every optional field at once: an input has no `null`, so a single `??` left off would render
    // the word "null" into a text box.
    expect(Object.values(fields).every((value) => typeof value === 'string')).toBe(true);
    expect(fields).toStrictEqual({
      name: 'Brutăria',
      countryCode: 'MD',
      legalForm: '',
      idno: '',
      lei: '',
      registeredAddressLine1: '',
      registeredAddressLine2: '',
      registeredLocality: '',
      registeredPostalCode: '',
      contactEmail: '',
      contactPhone: '',
      reportContactName: '',
      reportContactEmail: '',
    });
  });
});

describe('toPatch', () => {
  const typed = (over: Partial<ProfileFields> = {}): ProfileFields => ({
    ...toFields(stored()),
    ...over,
  });

  it('turns every empty and whitespace-only field back into null', () => {
    // Whitespace is the case a bare falsiness test misses: a reader who clears a field by selecting
    // its contents and typing a space has cleared it, and `' '` is not a value the API accepts.
    const patch = toPatch(typed({ legalForm: '   ', idno: '', contactPhone: ' \t ' }));

    const { name, countryCode, ...optional } = patch;
    expect(name).toBe('Brutăria');
    expect(countryCode).toBe('MD');
    expect(Object.values(optional).every((value) => value === null)).toBe(true);
  });

  it('trims what it keeps, so a stray space cannot make a saved field read as dirty', () => {
    expect(toPatch(typed({ name: '  Brutăria SRL  ', registeredLocality: ' Chișinău ' }))).toMatchObject(
      { name: 'Brutăria SRL', registeredLocality: 'Chișinău' },
    );
  });

  it('upper-cases the LEI, because that is the form the API stores and answers with', () => {
    // `formState.isDirty` is computed against `defaultValues`, which are re-seeded from the API's
    // answer. Sending a lower-cased LEI and getting the canonical one back would leave the field
    // permanently dirty with nothing the reader could do about it.
    expect(toPatch(typed({ lei: ' 529900t8bm49aurskz41 ' })).lei).toBe('529900T8BM49AURSKZ41');
  });

  it('round-trips a stored record unchanged', () => {
    // The composition is what the screen actually does on every save: read the record, seed the
    // form, send it back. Anything that survives one direction and not the other shows up here.
    const record = stored({ legalForm: 'srl', idno: '1003600000000', contactEmail: 'a@b.md' });

    expect(toPatch(toFields(record))).toMatchObject({
      legalForm: 'srl',
      idno: '1003600000000',
      contactEmail: 'a@b.md',
      lei: null,
    });
  });
});
