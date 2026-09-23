import type { Locale } from '@easyesg/i18n';

/**
 * S-27's record of a person (task 52.3; UC-13, UC-14; FR-9, FR-10, FR-52, FR-169; §12.5.6's task-52.3 row).
 *
 * **Its own model rather than more members on `Account`**, which every identity adapter maps and every session reads:
 * nothing but this screen reads a job title, a phone number or the export default, and widening the model every
 * sign-in reads would carry three values into flows that have no use for them.
 */
export interface AccountProfile {
  /** The sign-in address, which is the contact address (row (2)) — shown, never edited here. */
  readonly email: string;
  readonly givenName: string | null;
  readonly familyName: string | null;
  readonly jobTitle: string | null;
  /** `+` and the digits, as `phoneNumber` normalised it. */
  readonly phone: string | null;
  /** The interface's language (FR-10). */
  readonly locale: Locale;
  /** The language every message to this person is written in (FR-169). */
  readonly emailLocale: Locale;
  /** The language an export starts from, overridable on each (FR-52). */
  readonly exportLocale: Locale;
}

/** What a save writes: everything but the address, which is how the person signs in. */
export type AccountProfileChange = Omit<AccountProfile, 'email'>;
