'use client';

import { BUTTON_VARIANT, Button } from '@easyesg/ui';
import { useFormatter, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { ROUTES } from '@/lib/routes';
import { SECTION_READ } from '../../tools/credentials';
import { CREDENTIALS_SECTION, CREDENTIALS_STAGE } from '../../tools/credentials-state';
import { CredentialRow, rowBodyId } from '../shared/credential-row';
import { PASSWORD_MESSAGES } from '../shared/credentials-messages';
import { useCredentials } from '../shared/credentials-context';
import { RowNotice } from '../shared/row-notice';
import { SectionUnavailable } from '../shared/section-unavailable';
import { PasswordForm } from './password-form';

/**
 * S-28's password row (task 169; OQ-19 closed): *Last changed …* and *Change password*, opening the change in place.
 *
 * **The date and not the place.** The artboard's *from Chișinău* is not drawn: nothing records where a password was
 * changed, and deriving a place from an address would be new personal data (NFR-30). The date is
 * `GET /account/password`'s, which a failed sign-in does not move — `updated_at` would have.
 *
 * **An account with no password is offered one**, through the reset flow — the path by which a provider-only account
 * (FR-2) gets its first password (UC-09's alternate flow, task 67.11). `/reset` is open to a signed-in reader for that
 * reason (`lib/route-access.ts`). It is a link, not a disclosure: the password is set from the emailed link.
 */
export function PasswordRow() {
  const t = useTranslations(PASSWORD_MESSAGES);
  const format = useFormatter();
  const { read, stage, open, dismiss } = useCredentials();
  const id = CREDENTIALS_SECTION.PASSWORD;

  if (read.password.status !== SECTION_READ.READY) {
    return (
      <CredentialRow id={id} heading={t('heading')}>
        <SectionUnavailable />
      </CredentialRow>
    );
  }

  // The api answers a date exactly when a password is held; narrowing on the date is what lets the row draw one.
  const { changedAt } = read.password.value;
  if (changedAt === null) {
    return (
      <CredentialRow
        id={id}
        heading={t('heading')}
        description={t('unset')}
        triggers={
          <Button asChild variant={BUTTON_VARIANT.SECONDARY}>
            <Link href={ROUTES.RESET}>{t('set')}</Link>
          </Button>
        }
      />
    );
  }

  const isOpen = stage.kind === CREDENTIALS_STAGE.CHANGING_PASSWORD;

  return (
    <CredentialRow
      id={id}
      heading={t('heading')}
      // A legal date it is not, so the formatter's configured zone is right here (root CLAUDE.md, time rule).
      description={t('changed', { date: format.dateTime(new Date(changedAt), 'long') })}
      triggers={
        <Button
          type="button"
          variant={BUTTON_VARIANT.SECONDARY}
          aria-expanded={isOpen}
          aria-controls={rowBodyId(id)}
          onClick={() => (isOpen ? dismiss() : open({ kind: CREDENTIALS_STAGE.CHANGING_PASSWORD }))}
        >
          {t('change')}
        </Button>
      }
    >
      {isOpen ? (
        <>
          <RowNotice section={id} />
          <PasswordForm />
        </>
      ) : null}
    </CredentialRow>
  );
}
