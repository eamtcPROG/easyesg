import { SYSTEM_AUDIT_ACTION, type AdminRosterRow } from '@easyesg/contracts';
import { BUTTON_VARIANT, Button, DateField, Select } from '@easyesg/ui';
import { useMemo } from 'react';
import { useTranslations } from 'use-intl';
import { FilterBar } from '~/shared/filter-bar';
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
 *
 * **In the console's filter row since task 170** (`shared/filter-bar.tsx`; §5.2's preamble): the four
 * fields at one width, *Filtrați* and — while a filter is in force — *Ștergeți filtrele* on their
 * baseline, and below `wide` the row reflows as that component draws it.
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
    <FilterBar
      key={`${view.operator}|${view.action}|${view.from}|${view.to}`}
      label={t('filters.region')}
      action={(data) => onSubmit(logFiltersFromForm(data))}
      actions={
        <>
          <Button type="submit" variant={BUTTON_VARIANT.SECONDARY}>
            {t('filters.submit')}
          </Button>
          {logIsFiltered(view) ? (
            <Button type="button" variant={BUTTON_VARIANT.SUBTLE} onClick={onClear}>
              {t('filters.clear')}
            </Button>
          ) : null}
        </>
      }
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
    </FilterBar>
  );
}
