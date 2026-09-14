import { SUPPORT_ACCESS_ACTOR_REALM, type SupportAccessLogEntry } from '@easyesg/contracts';
import { BUTTON_VARIANT, Button, Panel } from '@easyesg/ui';
import { useFormatter, useTranslations } from 'use-intl';
import { accessModuleOf } from '../../../tools/access-subject';
import { RequestFacts } from '../../shared/request-facts';

/**
 * One log entry's record (task 67.9; UC-86; FR-79), beside the table: the whole of what the log keeps about a
 * request — the reason the organization read, when it was granted and when it was due to end, who ended it and from
 * which side, and every read made under it. **Read-only**: nothing in the console edits an entry.
 */
export function LogRecord({
  entry,
  onClose,
}: {
  readonly entry: SupportAccessLogEntry;
  readonly onClose: () => void;
}) {
  const t = useTranslations('platform.supportAccess');
  const format = useFormatter();

  const endedBy = (() => {
    if (entry.ended === null) return t('log.record.notEnded');
    const email = entry.ended.actorEmail ?? t('log.formerMember');
    return entry.ended.actorRealm === SUPPORT_ACCESS_ACTOR_REALM.ORGANIZATION
      ? t('log.record.endedByOrganization', { email })
      : t('log.record.endedByPlatform', { email });
  })();

  return (
    <aside aria-label={t('log.record.region')}>
      <Panel className="flex flex-col gap-[var(--space-4)] p-[var(--space-5)]">
        <h3 className="t-heading-3">{entry.organizationName ?? t('log.deletedOrganization')}</h3>
        <dl className="t-body grid grid-cols-[auto_1fr] gap-x-[var(--space-4)] gap-y-[var(--space-2)]">
          <dt className="text-[var(--text-muted)]">{t('log.requester')}</dt>
          <dd>{entry.requesterEmail ?? t('log.formerOperator')}</dd>
          <dt className="text-[var(--text-muted)]">{t('log.requestedAt')}</dt>
          <dd>{format.dateTime(entry.requestedAt, 'stamp')}</dd>
          <dt className="text-[var(--text-muted)]">{t('log.state')}</dt>
          <dd>{t(`state.${entry.state}`)}</dd>
          {entry.grantedAt === null ? (
            <>
              <dt className="text-[var(--text-muted)]">{t('log.record.lapses')}</dt>
              <dd>{format.dateTime(entry.lapsesAt, 'stamp')}</dd>
            </>
          ) : (
            <>
              <dt className="text-[var(--text-muted)]">{t('log.record.grantedAt')}</dt>
              <dd>{format.dateTime(entry.grantedAt, 'stamp')}</dd>
            </>
          )}
          {entry.expiresAt === null ? null : (
            <>
              <dt className="text-[var(--text-muted)]">{t('log.record.expiresAt')}</dt>
              <dd>{format.dateTime(entry.expiresAt, 'stamp')}</dd>
            </>
          )}
          <dt className="text-[var(--text-muted)]">{t('log.record.endedBy')}</dt>
          <dd>{endedBy}</dd>
        </dl>
        <RequestFacts entry={entry} />

        <h4 className="t-body-strong">{t('log.record.accessesTitle')}</h4>
        {entry.accesses.length === 0 ? (
          <p className="t-body text-[var(--text-muted)]">{t('log.record.noAccesses')}</p>
        ) : (
          <ol className="t-body flex flex-col gap-[var(--space-1)]">
            {entry.accesses.map((access, index) => {
              const purpose = t(`log.record.purpose.${access.purpose}`);
              const module = accessModuleOf(access.subject);
              return (
                <li key={`${access.occurredAt}:${index}`} className="flex flex-wrap gap-x-[var(--space-3)]">
                  <span>{format.dateTime(access.occurredAt, 'stamp')}</span>
                  <span>{module === null ? purpose : t('log.record.module', { purpose, module })}</span>
                </li>
              );
            })}
          </ol>
        )}

        <div>
          <Button type="button" variant={BUTTON_VARIANT.SECONDARY} onClick={onClose}>
            {t('log.record.close')}
          </Button>
        </div>
      </Panel>
    </aside>
  );
}
