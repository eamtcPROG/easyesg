import { CALLOUT_INTENT, Callout, TextLink } from '@easyesg/ui';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations } from 'next-intl/server';
import { PeriodRecordForm } from '@/features/periods/components/period-record-form';
import styles from '@/features/periods/components/periods.module.css';
import { readPeriodRecord } from '@/server/data/periods';
import { TENANT_READ } from '@/server/data/tenant-read';
import { Link } from '@/i18n/navigation';
import { activateRequestLocale, localizedPageTitle, type LocaleParams } from '@/i18n/page';
import { ROUTES } from '@/lib/routes';

/**
 * S-14's Record for one period (UC-56 … UC-58).
 *
 * **The reopenings are read with the period rather than behind a disclosure**: UX-72 requires an
 * amendment to look like an amendment, and one that has to be opened to be seen is one a reader can
 * miss — which is the state the requirement exists to prevent.
 *
 * States (§8.1): ready · read-only (locked, FR-22) · error — permission · error — recoverable. The
 * read-only state is the form's, because it is the form's controls that stop taking input.
 */
const MESSAGES = 'organization.periods';

type Props = { params: Promise<{ locale: string; entityId: string; periodId: string }> };

export const generateMetadata = localizedPageTitle(MESSAGES);

export default async function ReportingPeriodRecordPage({ params }: Props) {
  const { entityId, periodId } = await params;
  await activateRequestLocale(params as unknown as LocaleParams);
  const t = await getTranslations(MESSAGES);
  const [read, messages] = await Promise.all([
    readPeriodRecord({ entityId, periodId }),
    getMessages(),
  ]);

  if (read.status === TENANT_READ.FORBIDDEN) {
    return (
      <Callout
        intent={CALLOUT_INTENT.WARNING}
        title={t('error.permission.title')}
        action={
          <TextLink asChild>
            <Link href={ROUTES.HOME}>{t('error.permission.action')}</Link>
          </TextLink>
        }
      >
        {t('error.permission.body')}
      </Callout>
    );
  }

  if (read.status === TENANT_READ.UNREACHABLE) {
    return (
      <Callout
        intent={CALLOUT_INTENT.ERROR}
        title={t('error.unreachable.title')}
        action={t('error.unreachable.action')}
      >
        {t('error.unreachable.body')}
      </Callout>
    );
  }

  return (
    <div className={styles.record}>
      <p className="t-caption">{read.entity.name}</p>
      <NextIntlClientProvider
        messages={{
          organization: { periods: messages.organization.periods },
          forms: messages.forms,
        }}
      >
        <PeriodRecordForm
          entityId={entityId}
          period={read.period}
          reopenings={read.reopenings}
        />
      </NextIntlClientProvider>
    </div>
  );
}
