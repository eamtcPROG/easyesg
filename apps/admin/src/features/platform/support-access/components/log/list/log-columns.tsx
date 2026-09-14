import {
  SUPPORT_ACCESS_DECISION,
  type SupportAccessDecision,
  type SupportAccessLogEntry,
} from '@easyesg/contracts';
import { BUTTON_VARIANT, Button, type DataTableColumn } from '@easyesg/ui';
import { useMemo } from 'react';
import { useFormatter, useTranslations } from 'use-intl';

export const LOG_COLUMN = {
  REQUESTED_AT: 'requestedAt',
  ORGANIZATION: 'organization',
  REQUESTER: 'requester',
  TICKET: 'ticket',
  STATE: 'state',
  DECISION: 'decision',
  ACCESSES: 'accesses',
} as const;

export type LogColumn = (typeof LOG_COLUMN)[keyof typeof LOG_COLUMN];

/**
 * A-07's log columns (task 67.9; FR-79): when, over which organization, who asked, against which ticket, how it
 * stands, what the organization decided and who decided it, and how many reads it carried. **The reason, how it
 * ended and what each read opened are the record's**, beside the table — too long for a column, and still one click
 * from every row. **Nobody is ever blank**: a removed account and a deleted organization each say so.
 *
 * Memoised on the translators, the formatter and `onOpen` — `reactCompiler` is off.
 */
export function useLogColumns({
  onOpen,
}: {
  readonly onOpen: (entryId: string) => void;
}): readonly DataTableColumn<SupportAccessLogEntry, LogColumn>[] {
  const t = useTranslations('platform.supportAccess');
  const format = useFormatter();

  return useMemo(() => {
    const decided = (decision: SupportAccessDecision | null): string => {
      if (decision === null) return t('log.noDecision');
      const email = decision.actorEmail ?? t('log.formerMember');
      return decision.kind === SUPPORT_ACCESS_DECISION.GRANT
        ? t('log.granted', { email })
        : t('log.declined', { email });
    };

    return [
      {
        key: LOG_COLUMN.REQUESTED_AT,
        header: t('log.requestedAt'),
        cell: (entry: SupportAccessLogEntry) => (
          <Button type="button" variant={BUTTON_VARIANT.SUBTLE} onClick={() => onOpen(entry.id)}>
            {format.dateTime(entry.requestedAt, 'stamp')}
          </Button>
        ),
      },
      {
        key: LOG_COLUMN.ORGANIZATION,
        header: t('log.organization'),
        cell: (entry: SupportAccessLogEntry) => entry.organizationName ?? t('log.deletedOrganization'),
      },
      {
        key: LOG_COLUMN.REQUESTER,
        header: t('log.requester'),
        cell: (entry: SupportAccessLogEntry) => entry.requesterEmail ?? t('log.formerOperator'),
      },
      {
        key: LOG_COLUMN.TICKET,
        header: t('log.ticket'),
        cell: (entry: SupportAccessLogEntry) => entry.ticketReference,
      },
      {
        key: LOG_COLUMN.STATE,
        header: t('log.state'),
        cell: (entry: SupportAccessLogEntry) => t(`state.${entry.state}`),
      },
      {
        key: LOG_COLUMN.DECISION,
        header: t('log.decision'),
        cell: (entry: SupportAccessLogEntry) => decided(entry.decision),
      },
      {
        key: LOG_COLUMN.ACCESSES,
        header: t('log.accesses'),
        cell: (entry: SupportAccessLogEntry) => format.number(entry.accesses.length, 'integer'),
      },
    ];
  }, [t, format, onOpen]);
}
