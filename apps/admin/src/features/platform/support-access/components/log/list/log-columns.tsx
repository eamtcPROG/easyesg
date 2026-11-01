import {
  SUPPORT_ACCESS_DECISION,
  type SupportAccessDecision,
  type SupportAccessLogEntry,
} from '@easyesg/contracts';
import { COLUMN_ALIGN, type DataTableColumn } from '@easyesg/ui';
import { useMemo } from 'react';
import { useFormatter, useTranslations } from 'use-intl';
import { ROW_OPENS, RowActions } from '~/shared/row-actions';

export const LOG_COLUMN = {
  REQUESTED_AT: 'requestedAt',
  ORGANIZATION: 'organization',
  REQUESTER: 'requester',
  TICKET: 'ticket',
  STATE: 'state',
  DECISION: 'decision',
  ACCESSES: 'accesses',
  ACTIONS: 'actions',
} as const;

export type LogColumn = (typeof LOG_COLUMN)[keyof typeof LOG_COLUMN];

/**
 * A-07's log columns (task 67.9; FR-79): when, over which organization, who asked, against which ticket, how it
 * stands, what the organization decided and who decided it, and how many reads it carried. **The reason, how it
 * ended and what each read opened are the record's** — too long for a column, and still one click from every row.
 * **Nobody is ever blank**: a removed account and a deleted organization each say so.
 *
 * **The last column opens the record** (task 170; `design_spec.md` §5.2's preamble): *Vedeți*, since an entry is
 * read-only (FR-79), and no ⋯ menu, since an entry has no actions of its own. The time is plain text again — until
 * then it was the opener, a link-coloured button, and nothing on the row said what it opened. **The button is named
 * for the request** — its organization and when it was asked — because one organization can appear on many rows.
 *
 * Memoised on the translators, the formatter and `onOpen` — `reactCompiler` is off (AD-9).
 */
export function useLogColumns({
  onOpen,
}: {
  readonly onOpen: (entryId: string) => void;
}): readonly DataTableColumn<SupportAccessLogEntry, LogColumn>[] {
  const t = useTranslations('platform.supportAccess');
  const tChrome = useTranslations('chrome.rowActions');
  const format = useFormatter();

  return useMemo(() => {
    const decided = (decision: SupportAccessDecision | null): string => {
      if (decision === null) return t('log.noDecision');
      const email = decision.actorEmail ?? t('log.formerMember');
      return decision.kind === SUPPORT_ACCESS_DECISION.GRANT
        ? t('log.granted', { email })
        : t('log.declined', { email });
    };
    const organizationOf = (entry: SupportAccessLogEntry): string =>
      entry.organizationName ?? t('log.deletedOrganization');

    return [
      {
        key: LOG_COLUMN.REQUESTED_AT,
        header: t('log.requestedAt'),
        cell: (entry: SupportAccessLogEntry) => format.dateTime(entry.requestedAt, 'stamp'),
      },
      {
        key: LOG_COLUMN.ORGANIZATION,
        header: t('log.organization'),
        cell: organizationOf,
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
      {
        key: LOG_COLUMN.ACTIONS,
        header: tChrome('header'),
        align: COLUMN_ALIGN.END,
        cell: (entry: SupportAccessLogEntry) => (
          <RowActions
            name={t('log.rowName', {
              organization: organizationOf(entry),
              time: format.dateTime(entry.requestedAt, 'stamp'),
            })}
            opens={ROW_OPENS.VIEW}
            onOpen={() => onOpen(entry.id)}
          />
        ),
      },
    ];
  }, [t, tChrome, format, onOpen]);
}
