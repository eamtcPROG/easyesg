import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import type { CountryLegalForms, Organization } from '@easyesg/contracts';
import { EntityRecordForm } from '@/features/entities/components/entity-record-form';
import styles from '@/features/entities/components/entities.module.css';
import { API_OUTCOME } from '@/lib/api-outcome';
import { api } from '@/server/api-client';
import { activateRequestLocale, localizedPageTitle, type LocaleParams } from '@/i18n/page';

/**
 * S-13's Record in its **create** mode (UC-52) — `/entities/new`.
 *
 * A literal segment rather than a query flag on the record route, so an unsaved new entity is an
 * address the reader can return to and link (UX-4), and so the `[entityId]` route never has to
 * decide whether `new` is an id.
 *
 * **It reads the organization to know which legal forms to offer**, because that vocabulary is
 * scoped by the organization's country (§7.2) — the same country the API admits activity codes
 * against. A failure leaves the select empty rather than failing the screen: an entity is worth
 * creating with a name alone, and every other field on this record is optional by FR-17.
 */
export const generateMetadata = localizedPageTitle('organization.entities.record');

export default async function NewEntityPage({ params }: { params: LocaleParams }) {
  await activateRequestLocale(params);
  const [organization, vocabulary, messages] = await Promise.all([
    api.get<Organization>('/organization'),
    api.getList<CountryLegalForms>('/organizations/legal-forms'),
    getMessages(),
  ]);

  const country = organization.status === API_OUTCOME.Ok ? organization.value.countryCode : null;
  const formLabels: Readonly<Record<string, string>> = messages.organization.legalForms;
  const legalForms =
    vocabulary.status === API_OUTCOME.Ok && country !== null
      ? (vocabulary.value.items.find((entry) => entry.countryCode === country)?.legalForms ?? []).map(
          (form) => ({ value: form, label: formLabels[form] ?? form }),
        )
      : [];

  return (
    <div className={styles.screen}>
      <NextIntlClientProvider
        messages={{
          organization: { entities: messages.organization.entities },
          forms: messages.forms,
          identity: { unreachable: messages.identity.unreachable },
        }}
      >
        <EntityRecordForm entity={null} activity={[]} legalForms={legalForms} />
      </NextIntlClientProvider>
    </div>
  );
}
