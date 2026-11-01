import type { SupportAccessRequest } from '@easyesg/contracts';
import styles from '../styles/support-access.module.css';

/**
 * The ticket and the reason, as the operator wrote them (task 67.9) — what both banners show about a request, and
 * what the organization reads before it answers. Shared by the awaiting and active banners, which is its admission.
 */
export function RequestDetails({
  request,
  labels,
}: {
  readonly request: Pick<SupportAccessRequest, 'ticketReference' | 'reason'>;
  readonly labels: { readonly ticket: string; readonly reason: string };
}) {
  return (
    <dl className={styles.details}>
      <dt>{labels.ticket}</dt>
      <dd>{request.ticketReference}</dd>
      <dt>{labels.reason}</dt>
      <dd>{request.reason}</dd>
    </dl>
  );
}
