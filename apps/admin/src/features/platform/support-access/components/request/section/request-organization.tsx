import { useQuery } from '@tanstack/react-query';
import { API_OUTCOME } from '@easyesg/contracts';
import { useTranslations } from 'use-intl';
import { RefusalCallout } from '~/realm/components/shared/refusal-callout';
import { requestOrganizationQuery } from '../../../queries/support-access';
import { SupportAccessLoading } from '../../shared/support-access-loading';
import { RequestForm } from '../form/request-form';

/**
 * The organization a request is written for, read by id (task 67.9) — so the form names it from the register rather
 * than trusting a name carried in the address. **Any failure is drawn as the api worded it**: an organization that
 * is not in the register is a 404 with its own sentence, and the in-progress region below speaks for the screen's
 * signed-out and permission states.
 */
export function RequestOrganization({
  organizationId,
  onSent,
  onCancel,
}: {
  readonly organizationId: string;
  readonly onSent: (organizationName: string) => void;
  readonly onCancel: () => void;
}) {
  const t = useTranslations('platform.supportAccess.request');
  const query = useQuery(requestOrganizationQuery(organizationId));

  if (query.data === undefined) return <SupportAccessLoading />;
  if (query.data.status !== API_OUTCOME.Ok) {
    return (
      <RefusalCallout
        failure={query.data}
        title={t('organizationUnavailable')}
        fallback={t('organizationUnavailable')}
      />
    );
  }
  return <RequestForm organization={query.data.value} onSent={onSent} onCancel={onCancel} />;
}
