import { SUPPORT_ACCESS_STATE, type SupportAccessLogEntry } from '@easyesg/contracts';
import { Button, Panel } from '@easyesg/ui';
import { useFormatter, useTranslations } from 'use-intl';
import { GrantCountdown } from '../../shared/grant-countdown';
import { RequestFacts } from '../../shared/request-facts';
import { EndAccess } from './end-access';

/**
 * One request in progress (task 67.9): the organization, who asked, and either when it lapses unanswered or when
 * the running grant ends, with its countdown. A running grant offers its end to everyone and its reports to the
 * operator who asked.
 */
export function InProgressItem({
  entry,
  mayRead,
  onRead,
}: {
  readonly entry: SupportAccessLogEntry;
  readonly mayRead: boolean;
  readonly onRead: () => void;
}) {
  const t = useTranslations('platform.supportAccess');
  const format = useFormatter();
  const expiresAt = entry.state === SUPPORT_ACCESS_STATE.ACTIVE ? entry.expiresAt : null;

  return (
    <Panel className="flex flex-col gap-[var(--space-3)] p-[var(--space-4)]">
      <h3 className="t-body-strong">{entry.organizationName ?? t('log.deletedOrganization')}</h3>
      <p className="t-body text-[var(--text-muted)]">
        {entry.requesterEmail === null
          ? t('inProgress.formerOperator')
          : t('inProgress.requestedBy', { email: entry.requesterEmail })}
      </p>
      {expiresAt === null ? (
        <p className="t-body">
          {t('inProgress.awaiting', { time: format.dateTime(entry.lapsesAt, 'stamp') })}
        </p>
      ) : (
        <p className="t-body flex flex-wrap gap-x-[var(--space-2)]">
          <span>{t('inProgress.active', { time: format.dateTime(expiresAt, 'stamp') })}</span>
          <GrantCountdown expiresAt={expiresAt} />
        </p>
      )}
      <RequestFacts entry={entry} />
      {expiresAt === null ? null : (
        <div className="flex flex-wrap items-start gap-[var(--space-3)]">
          {mayRead ? (
            <Button type="button" onClick={onRead}>
              {t('inProgress.read')}
            </Button>
          ) : null}
          <EndAccess grant={{ organizationId: entry.organizationId, requestId: entry.id }} />
        </div>
      )}
    </Panel>
  );
}
