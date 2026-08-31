import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { PeriodRecordForm } from '@/features/periods/components/period-record-form';
import styles from '@/features/periods/components/periods.module.css';
import { activateRequestLocale, localizedPageTitle, type LocaleParams } from '@/i18n/page';

/**
 * S-14's Record in its create mode (UC-56).
 *
 * **A literal segment rather than a query flag**, following `ENTITY_NEW`: an unsaved new period is
 * an address the reader can return to (UX-4).
 *
 * It reads nothing. Everything the create form needs is the entity id in the path — the version pin
 * and the prior-period link are the system's to resolve at open (FR-45, FR-66, DR-4), so there is
 * nothing to fetch and no failure arm to draw. A refusal arrives from the write and the form
 * renders it.
 */
const MESSAGES = 'organization.periods';

type Props = { params: Promise<{ locale: string; entityId: string }> };

export const generateMetadata = localizedPageTitle(MESSAGES);

export default async function NewReportingPeriodPage({ params }: Props) {
  const { entityId } = await params;
  await activateRequestLocale(params as unknown as LocaleParams);
  const messages = await getMessages();

  return (
    <div className={styles.record}>
      <NextIntlClientProvider
        messages={{
          organization: { periods: messages.organization.periods },
          forms: messages.forms,
        }}
      >
        <PeriodRecordForm entityId={entityId} reopenings={[]} />
      </NextIntlClientProvider>
    </div>
  );
}
