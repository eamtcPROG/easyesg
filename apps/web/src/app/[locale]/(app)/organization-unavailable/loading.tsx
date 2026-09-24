import { getTranslations } from 'next-intl/server';
import { FocusColumn, Spinner } from '@easyesg/ui';
import { ORGANIZATION_UNAVAILABLE_MESSAGES } from '@/features/identity/unavailable/components/organization-unavailable-section';

/**
 * S-35's **loading — initial** (§8.1, UX-90; task 137): the section re-reads the memberships before it can say
 * whether the person is redirected or shown the notice, so the wait names that and not the failure — which this read
 * may be about to disprove. **No `activateRequestLocale` here**, correct only while `[locale]` declares `force-dynamic`.
 */
export default async function OrganizationUnavailableLoading() {
  const t = await getTranslations(ORGANIZATION_UNAVAILABLE_MESSAGES);

  return (
    <FocusColumn>
      <p className="t-body" role="status">
        <Spinner /> {t('loading')}
      </p>
    </FocusColumn>
  );
}
