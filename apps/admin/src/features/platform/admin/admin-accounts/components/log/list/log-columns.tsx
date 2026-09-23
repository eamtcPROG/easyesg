import type { SystemAuditLogEntry } from '@easyesg/contracts';
import type { DataTableColumn } from '@easyesg/ui';
import { useMemo } from 'react';
import { useFormatter, useTranslations } from 'use-intl';
import { NOTIFICATION_CATEGORY_LABEL } from '~/features/platform/shared/notification-category-label';
import { LOG_ACTION_LABEL, LOG_OBJECT, LOG_OPERATOR, logObjectOf, logOperatorOf } from '../../../tools/log-labels';

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
  const tProviders = useTranslations('platform.identityProviders.providers');
  const tCategories = useTranslations('platform.notificationCategories.categories');
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
        cell: (entry: SystemAuditLogEntry) => {
          const object = logObjectOf(entry);
          switch (object.kind) {
            case LOG_OBJECT.ADDRESS:
              return object.email;
            case LOG_OBJECT.PROVIDER:
              return tProviders(object.provider);
            case LOG_OBJECT.CATEGORY:
              return tCategories(NOTIFICATION_CATEGORY_LABEL[object.category]);
            case LOG_OBJECT.NONE:
              return t('noObject');
          }
        },
      },
    ],
    [t, tProviders, tCategories, format],
  );
}
