import { Callout, CALLOUT_INTENT, TextLink } from '@easyesg/ui';
import { getMessages, getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { ROUTES } from '@/lib/routes';
import { readEntityRecord } from '@/server/data/entities';
import { TENANT_READ } from '@/server/data/tenant-read';
import { redirectToChoiceIfOwed } from '@/shared/organization-choice-gate';
import { EntityRecordForm } from '../form/entity-record-form';
import { ENTITIES_MESSAGES } from '../shared/entity-messages';
import styles from '../styles/entities.module.css';

/**
 * S-13's record in its **edit** mode (UC-52 … UC-55; cut out of the route by task 137, `shell-composes-only`): the read,
 * and which of §8.1's arms applies — refused, not found, or the record's form.
 *
 * **Not found and unreachable are one arm, and the copy names the likelier cause.** RLS makes "another
 * organization's entity" and "no such entity" indistinguishable by design, so a 404 and a refusal arrive the same way;
 * telling the reader the address leads to no entity of *this* organization is true in every case that reaches it.
 */
export async function EntityRecordSection({ entityId }: { readonly entityId: string }) {
  const [read, t, messages] = await Promise.all([
    readEntityRecord(entityId),
    getTranslations(ENTITIES_MESSAGES),
    getMessages(),
  ]);

  if (read.status === TENANT_READ.FORBIDDEN) {
    // A choice not made is S-37's to answer, and this arm renders on every navigation (the gate says why).
    await redirectToChoiceIfOwed();
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
      <EntityRecordForm entity={read.entity} activity={read.activity} legalForms={legalForms} />
    </div>
  );
}
