import { describe, expect, it } from 'vitest';
import type { Organization } from '@easyesg/contracts';
import { toFields, toPatch, type ProfileFields } from './profile-fields';

/**
 * The one invariant this pair carries: **`''` and `null` are the same absence, and they round-trip**
 * (task 129). Before the split both directions sat inside the form — `toFields` as a module constant,
 * the patch as an object literal built inside the submit handler — so this could only be exercised by
 * driving a browser through every field — thirteen until tasks 175 and 177 moved what a report prints to S-13.
 *
 * **Asserted over the whole object, never field by field.** The failure mode here is one field
 * forgotten in one direction: a `??` missing from `toFields` renders `null` into an input, and an
 * `orNull` missing from `toPatch` sends `''` to an API that accepts it for nothing. A spec naming
 * one field would pass with the other three wrong, which is the shape a field-by-field spec invites.
 */
const stored = (over: Partial<Organization> = {}): Organization =>
  ({
    id: 'org-1',
    name: 'Brutăria',
    countryCode: 'MD',
    contactEmail: null,
    contactPhone: null,
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
      contactEmail: '',
      contactPhone: '',
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
    const patch = toPatch(typed({ contactEmail: '   ', contactPhone: ' \t ' }));

    const { name, countryCode, ...optional } = patch;
    expect(name).toBe('Brutăria');
    expect(countryCode).toBe('MD');
    expect(Object.values(optional).every((value) => value === null)).toBe(true);
  });

  it('trims what it keeps, so a stray space cannot make a saved field read as dirty', () => {
    expect(toPatch(typed({ name: '  Brutăria SRL  ', contactPhone: ' +373 22 000 000 ' }))).toMatchObject(
      { name: 'Brutăria SRL', contactPhone: '+373 22 000 000' },
    );
  });

  it('round-trips a stored record unchanged', () => {
    // The composition is what the screen actually does on every save: read the record, seed the
    // form, send it back. Anything that survives one direction and not the other shows up here.
    const record = stored({ contactEmail: 'a@b.md' });

    expect(toPatch(toFields(record))).toStrictEqual({
      name: 'Brutăria',
      countryCode: 'MD',
      contactEmail: 'a@b.md',
      contactPhone: null,
    });
  });
});
