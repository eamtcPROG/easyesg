import { Callout, CALLOUT_INTENT, TextLink } from '@easyesg/ui';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations } from 'next-intl/server';
import { EntityRecordForm } from '@/features/entities/components/entity-record-form';
import styles from '@/features/entities/components/entities.module.css';
import { readEntityRecord } from '@/server/data/entities';
import { TENANT_READ } from '@/server/data/tenant-read';
import { Link } from '@/i18n/navigation';
import { activateRequestLocale, localizedPageTitle, type LocaleParams } from '@/i18n/page';
import { ROUTES } from '@/lib/routes';

/**
 * S-13 — Entity record · OA · UC-52 … UC-55 · Record
 *
 * D-2: entity master data is OA-owned; disclosure content is RC-owned. B1 pre-populates from this
 * record (FR-27) but stays editable in-report — B1 is a disclosure, not master data.
 *
 * **The artboard's Size region is absent**, and it is the one omission worth stating on this screen
 * rather than only in the plan: employee count and balance-sheet total are B1 disclosure data
 * (UC-19), gathered per reporting period, and the artboard's own callout — *"Fifty or more
 * employees changes what the 2026 report asks"* — describes conditional applicability, which is
 * task 41's rule interpreter over a period that does not exist until task 31. Recording a headcount
 * here would make master data of something the standard asks per report.
 *
 * The per-field **change history** the artboard draws is S-12, appended as task 84 while task 30.3
 * was looking for its owner.
 */
const MESSAGES = 'organization.entities';

export const generateMetadata = localizedPageTitle('organization.entities.record');

export default async function EntityRecordPage({
  params,
}: {
  params: Promise<{ locale: string; entityId: string }>;
}) {
  const { entityId } = await params;
  await activateRequestLocale(params as unknown as LocaleParams);
  const [read, t, messages] = await Promise.all([
    readEntityRecord(entityId),
    getTranslations(MESSAGES),
    getMessages(),
  ]);

  if (read.status === TENANT_READ.FORBIDDEN) {
    return (
      <div className={styles.screen}>
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
      </div>
    );
  }

  if (read.status === TENANT_READ.UNREACHABLE) {
    // **Not found and unreachable are one arm here, and the copy names the likelier cause.** RLS
    // makes "another organization's entity" and "no such entity" indistinguishable by design, so
    // a 404 and a refusal arrive the same way; telling the reader the address leads to no entity
    // of *this* organization is true in every case that reaches this branch.
    return (
      <div className={styles.screen}>
        <Callout
          intent={CALLOUT_INTENT.ERROR}
          title={t('error.notFound.title')}
          action={
            <TextLink asChild>
              <Link href={ROUTES.ENTITIES}>{t('error.notFound.action')}</Link>
            </TextLink>
          }
        >
          {t('error.notFound.body')}
        </Callout>
      </div>
    );
  }

  const formLabels: Readonly<Record<string, string>> = messages.organization.legalForms;
  const legalForms = (
    read.countries.find((entry) => entry.countryCode === read.entity.legalForm)?.legalForms ??
    read.countries[0]?.legalForms ??
    []
  ).map((form) => ({ value: form, label: formLabels[form] ?? form }));

  return (
    <div className={styles.screen}>
      <NextIntlClientProvider
        messages={{
          organization: { entities: messages.organization.entities },
          forms: messages.forms,
          identity: { unreachable: messages.identity.unreachable },
        }}
      >
        <EntityRecordForm
          entity={read.entity}
          activity={read.activity}
          legalForms={legalForms}
        />
      </NextIntlClientProvider>
    </div>
  );
}
