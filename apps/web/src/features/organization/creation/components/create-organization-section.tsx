import { getMessages, getTranslations } from 'next-intl/server';
import { FOCUS_MEASURE, FocusColumn } from '@easyesg/ui';
import type { CountryLegalForms } from '@easyesg/contracts';
import { API_OUTCOME } from '@/lib/api-outcome';
import { api } from '@/server/api/api-client';
import { CreateOrganizationForm, type CountryOption } from './create-organization-form';
import { CREATE_ORGANIZATION_MESSAGES } from './create-organization-messages';
import styles from './create-organization.module.css';

/**
 * S-04's one region (UC-49; cut out of the route by task 137, `shell-composes-only`): the countries the API accepts,
 * named in the reader's language, and the form over them. **Its read runs after the shell has set the request
 * locale**, which is what the route's sequential await is for — `api-client` resolves `getLocale()` for
 * `Accept-Language`, and a read issued first would bring back problem text in the wrong language.
 */
export async function CreateOrganizationSection() {
  const [outcome, t, messages] = await Promise.all([
    api.getList<CountryLegalForms>('/organizations/legal-forms'),
    getTranslations(CREATE_ORGANIZATION_MESSAGES),
    getMessages(),
  ]);

  /**
   * The countries the API accepts, named in the reader's language.
   *
   * **A country code is a key, never a label** (CLAUDE.md's user-facing-text rule): `MD` on a
   * screen is an internal identifier, and OQ-43 puts the wording in the release catalogue rather
   * than the store. A country registered ahead of its wording renders its key, which next-intl
   * makes visible rather than silent — the same trade the legal-form list takes.
   *
   * The lookup is the catalogue **object**, not `t(code)`, and that is forced rather than chosen:
   * the app's `IntlMessages` augmentation narrows the namespace's keys to the ones authored, so a
   * translator call typed to `'MD'` cannot be handed a value the API supplies. Casting it would be
   * an assertion that the API only ever answers what this catalogue happens to hold, which is the
   * opposite of what AD-4 makes true. Indexing a `Record<string, string>` states the real
   * relationship — an open set of keys against a closed set of words.
   *
   * An unreachable API yields an empty list, which the form renders as a select with no options
   * and a `required` rule that cannot be satisfied. That is honest and, unlike a hidden field,
   * visible: nobody creates an organization in a country the platform did not confirm it operates
   * in.
   */
  const labels: Readonly<Record<string, string>> = messages.organization.countries;
  const countries: CountryOption[] =
    outcome.status === API_OUTCOME.Ok
      ? outcome.value.items.map((entry) => ({
          code: entry.countryCode,
          label: labels[entry.countryCode] ?? entry.countryCode,
        }))
      : [];

  return (
    <FocusColumn measure={FOCUS_MEASURE.WIDE}>
      <h1 className={`t-heading-1 ${styles.title}`}>{t('title')}</h1>
      <p className={`t-body ${styles.subtitle}`}>{t('subtitle')}</p>
      <CreateOrganizationForm countries={countries} />
      <p className={`t-caption ${styles.waiting}`}>{t('waitingForInvitation')}</p>
    </FocusColumn>
  );
}
