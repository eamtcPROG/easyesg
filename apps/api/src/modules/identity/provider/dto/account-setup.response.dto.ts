import { ApiProperty } from '@nestjs/swagger';
import { LOCALES, type Locale } from '@easyesg/i18n';
import { ACCOUNT_STATUS, type AccountStatus } from '@api/modules/identity/account/models/account.model';
import type { AccountSetupState } from '../models/account-setup.model';

/**
 * An account's setup as it leaves the API (task 155; S-36) — what the screen renders from: which step
 * is owed, the name parts to pre-fill and the language to pre-select, with the address for the
 * password step's "for" line. The deadline is not here: it is the api's to enforce, and nothing on the
 * screen acts on it.
 */
export class AccountSetupResponseDto {
  @ApiProperty({
    enum: Object.values(ACCOUNT_STATUS),
    description:
      '`awaiting_setup` until the account holds a password and both name parts; `active` once it does.',
  })
  readonly status: AccountStatus;

  @ApiProperty({ format: 'email', example: 'ana.popescu@example.md' })
  readonly email: string;

  @ApiProperty({
    type: String,
    nullable: true,
    example: 'Ana',
    description:
      'As stored. For an account registered through a provider, the name the provider asserted, until ' +
      'the account saves its own.',
  })
  readonly givenName: string | null;

  @ApiProperty({ type: String, nullable: true, example: 'Popescu' })
  readonly familyName: string | null;

  @ApiProperty({
    enum: [...LOCALES],
    description: 'The interface language persisted on the account (FR-10).',
  })
  readonly locale: Locale;

  @ApiProperty({ description: 'Whether the account holds a password — the first step is done when it does.' })
  readonly passwordSet: boolean;

  constructor(state: AccountSetupState) {
    this.status = state.account.status;
    this.email = state.account.email;
    this.givenName = state.account.givenName;
    this.familyName = state.account.familyName;
    this.locale = state.account.locale;
    this.passwordSet = state.passwordSet;
  }
}
