import { getTranslations } from 'next-intl/server';
import { FOCUS_MEASURE, FocusColumn, Spinner } from '@easyesg/ui';
import { CREATE_ORGANIZATION_MESSAGES } from '@/features/organization/creation/components/create-organization-messages';
import styles from '@/features/organization/creation/components/create-organization.module.css';

/**
 * S-04's **loading — initial** (§8.1, UX-90; task 137), on S-16's precedent: the form waits on the countries the API
 * accepts. The heading and subtitle are the real ones, so nothing shifts when the form arrives. **No
 * `activateRequestLocale` here** — Next passes `loading.tsx` no props, correct only while `[locale]` declares
 * `force-dynamic`.
 */
export default async function CreateOrganizationLoading() {
  const t = await getTranslations(CREATE_ORGANIZATION_MESSAGES);

  return (
    <FocusColumn measure={FOCUS_MEASURE.WIDE}>
      <h1 className={`t-heading-1 ${styles.title}`}>{t('title')}</h1>
      <p className={`t-body ${styles.subtitle}`}>{t('subtitle')}</p>
      <p className="t-body" role="status">
        <Spinner /> {t('loading')}
      </p>
    </FocusColumn>
  );
}
