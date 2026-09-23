import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';
import { toLocale } from '@easyesg/i18n';
import type { AccountProfileStore } from '@api/modules/identity/account/interfaces/account-profile-store.interface';
import type { AccountProfile, AccountProfileChange } from '@api/modules/identity/account/models/account-profile.model';
import { CORE_DATA_SOURCE } from '../data-source';
import { returnedRows } from '../returned-rows';

interface ProfileRow {
  email: string;
  given_name: string | null;
  family_name: string | null;
  job_title: string | null;
  phone: string | null;
  locale: string;
  email_locale: string;
  export_locale: string;
}

const PROFILE_COLUMNS = 'email, given_name, family_name, job_title, phone, locale, email_locale, export_locale';

/**
 * `ACCOUNT_PROFILE_STORE` over `identity.account` (task 52.3; §12.5.6's task-52.3 row).
 *
 * **It binds no tenant**, as no `/account/*` store does: the table carries no organization, and the account id every
 * statement names is the session's, which the service resolves and no caller supplies. **One statement per call**, so
 * a save has no transaction to hold: the `UPDATE … RETURNING` is atomic on its own and answers what it wrote.
 */
@Injectable()
export class AccountProfileStoreRepository implements AccountProfileStore {
  constructor(@InjectDataSource(CORE_DATA_SOURCE) private readonly dataSource: DataSource) {}

  async find(query: { readonly accountId: string }): Promise<AccountProfile | null> {
    const rows = await this.dataSource.query<ProfileRow[]>(
      `SELECT ${PROFILE_COLUMNS} FROM identity.account WHERE id = $1`,
      [query.accountId],
    );
    return rows[0] === undefined ? null : toProfile(rows[0]);
  }

  async save(command: { readonly accountId: string; readonly change: AccountProfileChange }): Promise<AccountProfile | null> {
    const { change } = command;
    const rows = returnedRows<ProfileRow>(
      await this.dataSource.query(
        `UPDATE identity.account
            SET given_name = $2, family_name = $3, job_title = $4, phone = $5,
                locale = $6, email_locale = $7, export_locale = $8, updated_at = now()
          WHERE id = $1
          RETURNING ${PROFILE_COLUMNS}`,
        [
          command.accountId,
          change.givenName,
          change.familyName,
          change.jobTitle,
          change.phone,
          change.locale,
          change.emailLocale,
          change.exportLocale,
        ],
      ),
    );
    return rows[0] === undefined ? null : toProfile(rows[0]);
  }
}

const toProfile = (row: ProfileRow): AccountProfile => ({
  email: row.email,
  givenName: row.given_name,
  familyName: row.family_name,
  jobTitle: row.job_title,
  phone: row.phone,
  locale: toLocale(row.locale),
  emailLocale: toLocale(row.email_locale),
  exportLocale: toLocale(row.export_locale),
});
