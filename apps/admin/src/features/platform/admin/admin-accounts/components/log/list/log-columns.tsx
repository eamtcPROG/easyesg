import type { SystemAuditLogEntry } from '@easyesg/contracts';
import type { DataTableColumn } from '@easyesg/ui';
import { useMemo } from 'react';
import { useFormatter, useTranslations } from 'use-intl';
import { LOG_ACTION_LABEL, LOG_OPERATOR, logOperatorOf } from '../../../tools/log-labels';

export const LOG_COLUMN = {
  TIME: 'time',
  OPERATOR: 'operator',
  ACTION: 'action',
  OBJECT: 'object',
} as const;

export type LogColumn = (typeof LOG_COLUMN)[keyof typeof LOG_COLUMN];

/**
 * A-08's log columns (task 67.4): when, who, what, and on what — the artboard's, less its *scope*
 * column, which arrives with the first operation that discloses a blast radius (§5.2 A-08). **Who** is
 * never blank: an entry with no actor says whether that was the provisioning command or an address
 * matching no account (`log-labels.ts`).
 */
export function useLogColumns(): readonly DataTableColumn<SystemAuditLogEntry, LogColumn>[] {
  const t = useTranslations('platform.accounts.log');
  const format = useFormatter();

  return useMemo(
    () => [
      {
        key: LOG_COLUMN.TIME,
        header: t('time'),
        cell: (entry: SystemAuditLogEntry) => format.dateTime(entry.occurredAt, 'stamp'),
      },
      {
        key: LOG_COLUMN.OPERATOR,
        header: t('operator'),
        cell: (entry: SystemAuditLogEntry) => {
          const operator = logOperatorOf(entry);
          switch (operator.kind) {
            case LOG_OPERATOR.ACCOUNT:
              return operator.email;
            case LOG_OPERATOR.PROVISIONING:
              return t('provisioning');
            case LOG_OPERATOR.FORMER:
              return t('formerOperator');
            case LOG_OPERATOR.UNKNOWN_ADDRESS:
              return t('unknownOperator');
          }
        },
      },
      {
        key: LOG_COLUMN.ACTION,
        header: t('action'),
        cell: (entry: SystemAuditLogEntry) => t(`actions.${LOG_ACTION_LABEL[entry.action]}`),
      },
      {
        key: LOG_COLUMN.OBJECT,
        header: t('object'),
        cell: (entry: SystemAuditLogEntry) => entry.targetEmail ?? t('noObject'),
      },
    ],
    [t, format],
  );
}
