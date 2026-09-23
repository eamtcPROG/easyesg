import { describe, expect, it } from 'vitest';
import {
  changedParts,
  switchIndex,
  toFields,
  toPreferencesSave,
  toProfileSave,
  type ProfileRecord,
} from './profile-fields';

/** S-27's form and its two writes (task 52.3) — literals on purpose: they are the wire values. */
const RECORD: ProfileRecord = {
  profile: {
    email: 'ana@lina.md',
    givenName: 'Ana',
    familyName: 'Rusu',
    displayName: 'Ana Rusu',
    monogram: 'AR',
    jobTitle: null,
    phone: '+37369123456',
    // Three different languages, so a conversion that wrote one into another's place cannot pass (task 52's close).
    locale: 'ro',
    emailLocale: 'ru',
    exportLocale: 'en',
  },
  preferences: {
    categories: [
      {
        categoryKey: 'identity.password_reset',
        categoryName: 'Resetarea parolei',
        mandatory: true,
        channels: [{ channel: 'email', enabled: true }],
      },
      {
        categoryKey: 'reporting.manual_reminder',
        categoryName: 'Mementouri',
        mandatory: false,
        channels: [
          { channel: 'in_app', enabled: true },
          { channel: 'email', enabled: false },
        ],
      },
    ],
  },
};

describe('toFields', () => {
  it('makes a switch of every offered pair, and none of a mandatory category', () => {
    expect(toFields(RECORD).switches).toEqual([
      { categoryKey: 'reporting.manual_reminder', channel: 'in_app', enabled: true },
      { categoryKey: 'reporting.manual_reminder', channel: 'email', enabled: false },
    ]);
  });

  it('reads an absent optional field as empty', () => {
    expect(toFields(RECORD).jobTitle).toBe('');
  });
});

describe('the two writes', () => {
  it('sends each language to its own member', () => {
    expect(toProfileSave(toFields(RECORD))).toMatchObject({ locale: 'ro', emailLocale: 'ru', exportLocale: 'en' });
  });

  it('sends a blank optional field as null, which clears it', () => {
    expect(toProfileSave({ ...toFields(RECORD), jobTitle: '  ', phone: '' })).toMatchObject({
      jobTitle: null,
      phone: null,
    });
  });

  it('sends every offered switch left off', () => {
    expect(toPreferencesSave(toFields(RECORD))).toEqual({
      switchedOff: [{ categoryKey: 'reporting.manual_reminder', channel: 'email' }],
    });
  });
});

describe('changedParts', () => {
  const fields = toFields(RECORD);

  it('writes nothing for an unchanged form', () => {
    expect(changedParts({ fields, stored: RECORD })).toEqual({ profile: false, preferences: false });
  });

  it('writes only the profile when only a profile field differs', () => {
    expect(changedParts({ fields: { ...fields, emailLocale: 'en' }, stored: RECORD })).toEqual({
      profile: true,
      preferences: false,
    });
  });

  it('writes only the preferences when only a switch differs', () => {
    const switches = fields.switches.map((entry) => ({ ...entry, enabled: true }));
    expect(changedParts({ fields: { ...fields, switches }, stored: RECORD })).toEqual({
      profile: false,
      preferences: true,
    });
  });
});

describe('switchIndex', () => {
  it('finds a pair at the index its switch was built at, and a mandatory pair nowhere', () => {
    const { preferences } = RECORD;
    expect(switchIndex({ preferences, categoryKey: 'reporting.manual_reminder', channel: 'email' })).toBe(1);
    expect(switchIndex({ preferences, categoryKey: 'identity.password_reset', channel: 'email' })).toBe(-1);
  });
});
