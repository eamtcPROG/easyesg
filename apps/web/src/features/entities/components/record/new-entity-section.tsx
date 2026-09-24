import type { CountryLegalForms, Organization } from '@easyesg/contracts';
import { getMessages } from 'next-intl/server';
import { API_OUTCOME } from '@/lib/api-outcome';
import { api } from '@/server/api/api-client';
import { isPermissionRefusal } from '@/server/data/tenant-read';
import { redirectToChoiceIfOwed } from '@/shared/organization-choice-gate';
import { EntityRecordForm } from '../form/entity-record-form';
import styles from '../styles/entities.module.css';

/**
 * S-13's record in its **create** mode (UC-52; cut out of the route by task 137, `shell-composes-only`).
 *
 * **It reads the organization to know which legal forms to offer**, because that vocabulary is scoped by the
 * organization's country (§7.2) — the same country the API admits activity codes against. A failure leaves the select
 * empty rather than failing the screen: an entity is worth creating with a name alone, and every other field on this
 * record is optional by FR-17.
 */
export async function NewEntitySection() {
  const [organization, vocabulary, messages] = await Promise.all([
    api.get<Organization>('/organization'),
    api.getList<CountryLegalForms>('/organizations/legal-forms'),
    getMessages(),
  ]);

  // A choice not made is S-37's to answer, and this read is where a navigation meets it (the gate says why).
  if (isPermissionRefusal(organization)) await redirectToChoiceIfOwed();
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
      <EntityRecordForm entity={null} activity={[]} legalForms={legalForms} />
    </div>
  );
}
