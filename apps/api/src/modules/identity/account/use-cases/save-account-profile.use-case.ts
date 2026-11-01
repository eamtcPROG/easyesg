import type { Locale } from '@easyesg/i18n';
import { AuthenticationRequiredError } from '@api/modules/identity/membership/errors/membership.errors';
import { presentNamePart } from '../domain/display-name';
import { PHONE_MALFORMED, phoneNumber } from '../domain/phone-number';
import { PhoneNumberMalformedError, ProfileNamesRequiredError } from '../errors/account.errors';
import type { AccountProfileStore } from '../interfaces/account-profile-store.interface';
import type { AccountProfile } from '../models/account-profile.model';

export interface SaveAccountProfileCommand {
  readonly accountId: string;
  readonly givenName: string;
  readonly familyName: string;
  readonly jobTitle?: string | null;
  readonly phone?: string | null;
  readonly locale: Locale;
  readonly emailLocale: Locale;
  readonly exportLocale: Locale;
}

/**
 * UC-13 and UC-14's save — S-27 is a Record, so the whole profile at once (task 52.3; FR-9, FR-10, FR-52, FR-169;
 * §12.5.6's task-52.3 row).
 *
 * **Judged before anything is written**: both name parts present once trimmed, as registration and setup require
 * (`presentNamePart`'s reading); a job title trimmed and absent when empty; a phone number in `phoneNumber`'s one
 * spelling or refused. **The address is not part of it** — it is how the person signs in (row (2)).
 *
 * **A rename changes what every surface shows at once**, since the display name is derived (UX-137) and never
 * stored; the session's copy is the caller's to refresh.
 */
export class SaveAccountProfile {
  constructor(private readonly store: AccountProfileStore) {}

  async execute(command: SaveAccountProfileCommand): Promise<AccountProfile> {
    const givenName = presentNamePart(command.givenName);
    const familyName = presentNamePart(command.familyName);
    if (givenName === null || familyName === null) throw new ProfileNamesRequiredError();

    const phone = phoneNumber(command.phone);
    if (phone === PHONE_MALFORMED) throw new PhoneNumberMalformedError();

    const saved = await this.store.save({
      accountId: command.accountId,
      change: {
        givenName,
        familyName,
        jobTitle: presentNamePart(command.jobTitle),
        phone,
        locale: command.locale,
        emailLocale: command.emailLocale,
        exportLocale: command.exportLocale,
      },
    });
    if (saved === null) throw new AuthenticationRequiredError();
    return saved;
  }
}
