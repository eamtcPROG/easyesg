import type {
  AccountProfile,
  CategoryPreferences,
  NotificationPreferences,
  SaveAccountProfileRequest,
  SetNotificationPreferencesRequest,
} from '@easyesg/contracts';
import type { Locale } from '@easyesg/i18n';

/**
 * S-27's form and the two writes it becomes (task 52.3; UC-13, UC-14, UC-168).
 *
 * **One form over three sections, two resources**: `PUT /account/profile` and `PUT /account/notification-preferences`
 * are separate owners' routes (`identity/account`, `platform/notification`), and S-27 is one Record with one save. So
 * the form holds both, and `changedParts` says which the save must write — an unchanged half is not rewritten.
 *
 * **Each switch is an array element, never a key**: a category key carries dots, and react-hook-form reads a dot in a
 * field name as a path. Only the pairs the read offers as switches are fields; a mandatory category is not a field at
 * all, since nothing about it can change.
 */
export interface ProfileFields {
  givenName: string;
  familyName: string;
  jobTitle: string;
  phone: string;
  locale: Locale;
  emailLocale: Locale;
  exportLocale: Locale;
  switches: PreferenceSwitch[];
}

export interface PreferenceSwitch {
  categoryKey: CategoryPreferences['categoryKey'];
  channel: CategoryPreferences['channels'][number]['channel'];
  enabled: boolean;
}

/** What S-27 read — the record a discard restores and a save re-seeds from. */
export interface ProfileRecord {
  readonly profile: AccountProfile;
  readonly preferences: NotificationPreferences;
}

export const toFields = (record: ProfileRecord): ProfileFields => ({
  givenName: record.profile.givenName ?? '',
  familyName: record.profile.familyName ?? '',
  jobTitle: record.profile.jobTitle ?? '',
  phone: record.profile.phone ?? '',
  locale: record.profile.locale,
  emailLocale: record.profile.emailLocale,
  exportLocale: record.profile.exportLocale,
  switches: switchesOf(record.preferences),
});

/** The profile half of a save. A blank optional field is sent as `null`, which clears it. */
export const toProfileSave = (fields: ProfileFields): SaveAccountProfileRequest => ({
  givenName: fields.givenName,
  familyName: fields.familyName,
  jobTitle: blankAsNull(fields.jobTitle),
  phone: blankAsNull(fields.phone),
  locale: fields.locale,
  emailLocale: fields.emailLocale,
  exportLocale: fields.exportLocale,
});

/** The preferences half: every offered switch left off. */
export const toPreferencesSave = (fields: ProfileFields): SetNotificationPreferencesRequest => ({
  switchedOff: fields.switches
    .filter((entry) => !entry.enabled)
    .map(({ categoryKey, channel }) => ({ categoryKey, channel })),
});

/** Which of the two resources a save must write — the one whose own fields differ from what was stored. */
export const changedParts = (input: {
  readonly fields: ProfileFields;
  readonly stored: ProfileRecord;
}): { readonly profile: boolean; readonly preferences: boolean } => {
  const stored = toFields(input.stored);
  const { switches, ...profile } = input.fields;
  const { switches: storedSwitches, ...storedProfile } = stored;
  return {
    profile: JSON.stringify(profile) !== JSON.stringify(storedProfile),
    preferences: JSON.stringify(switches.map((entry) => entry.enabled)) !==
      JSON.stringify(storedSwitches.map((entry) => entry.enabled)),
  };
};

/**
 * Where a pair's switch sits in `ProfileFields.switches` — the order `toFields` builds them in, which is the read's own
 * order. The field is named by this index, since a category key's dots cannot be a field name.
 */
export const switchIndex = (input: {
  readonly preferences: NotificationPreferences;
  readonly categoryKey: PreferenceSwitch['categoryKey'];
  readonly channel: PreferenceSwitch['channel'];
}): number =>
  switchesOf(input.preferences).findIndex(
    (entry) => entry.categoryKey === input.categoryKey && entry.channel === input.channel,
  );

const switchesOf = (preferences: NotificationPreferences): PreferenceSwitch[] =>
  preferences.categories
    .filter((category) => !category.mandatory)
    .flatMap((category) =>
      category.channels.map(({ channel, enabled }) => ({ categoryKey: category.categoryKey, channel, enabled })),
    );

const blankAsNull = (value: string): string | null => (value.trim() === '' ? null : value);
