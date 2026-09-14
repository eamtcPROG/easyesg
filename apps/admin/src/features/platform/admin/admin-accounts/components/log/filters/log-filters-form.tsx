import { SYSTEM_AUDIT_ACTION, type AdminRosterRow } from '@easyesg/contracts';
import { BUTTON_VARIANT, Button, DateField, Select } from '@easyesg/ui';
import { useMemo } from 'react';
import { useTranslations } from 'use-intl';
import {
  ANY_LOG_FILTER,
  logFiltersFromForm,
  logIsFiltered,
  type LogFilters,
  type LogView,
} from '../../../tools/accounts-search';
import { LOG_ACTION_LABEL } from '../../../tools/log-labels';

/**
 * A-08's log filters (task 67.4) — operator, action and a range of days, held in the URL. **A form
 * `action`**, the register's search form's shape: a native submission before hydration would answer
 * 405 from the static host, and an uncontrolled form keyed on the view resets when the address moves.
 */
export function LogFiltersForm({
  view,
  operators,
  onSubmit,
  onClear,
}: {
  readonly view: LogView;
  readonly operators: readonly AdminRosterRow[];
  readonly onSubmit: (filters: LogFilters) => void;
  readonly onClear: () => void;
}) {
  const t = useTranslations('platform.accounts.log');

  const operatorOptions = useMemo(
    () => [
      { value: ANY_LOG_FILTER, label: t('filters.anyOperator') },
      ...operators.map((row) => ({ value: row.id, label: row.email })),
    ],
    [operators, t],
  );

  const actionOptions = useMemo(
    () => [
      { value: ANY_LOG_FILTER, label: t('filters.anyAction') },
      ...Object.values(SYSTEM_AUDIT_ACTION).map((action) => ({
        value: action,
        label: t(`actions.${LOG_ACTION_LABEL[action]}`),
      })),
    ],
    [t],
  );

  return (
    <form
      key={`${view.operator}|${view.action}|${view.from}|${view.to}`}
      role="search"
      aria-label={t('filters.region')}
      className="flex flex-wrap items-end gap-[var(--space-3)]"
      action={(data) => onSubmit(logFiltersFromForm(data))}
    >
      <Select
        name="operator"
        label={t('filters.operator')}
        options={operatorOptions}
        defaultValue={view.operator ?? ANY_LOG_FILTER}
      />
      <Select
        name="action"
        label={t('filters.action')}
        options={actionOptions}
        defaultValue={view.action ?? ANY_LOG_FILTER}
      />
      <DateField name="from" label={t('filters.from')} defaultValue={view.from ?? ''} />
      <DateField name="to" label={t('filters.to')} defaultValue={view.to ?? ''} />
      <Button type="submit" variant={BUTTON_VARIANT.SECONDARY}>
        {t('filters.submit')}
      </Button>
      {logIsFiltered(view) ? (
        <Button type="button" variant={BUTTON_VARIANT.SUBTLE} onClick={onClear}>
          {t('filters.clear')}
        </Button>
      ) : null}
    </form>
  );
}
