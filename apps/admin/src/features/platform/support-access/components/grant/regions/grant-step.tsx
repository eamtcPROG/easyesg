import { useQuery } from '@tanstack/react-query';
import { API_OUTCOME, type DisclosureField } from '@easyesg/contracts';
import { BUTTON_VARIANT, Button } from '@easyesg/ui';
import { Fragment } from 'react';
import { useFormatter, useTranslations } from 'use-intl';
import { grantStepQuery } from '../../../queries/support-access';
import { FIELD_DISPLAY, fieldDisplayOf } from '../../../tools/field-display';
import type { GrantScope } from '../../../tools/support-access-search';
import { SupportAccessLoading } from '../../shared/support-access-loading';
import { GrantFailure } from '../shared/grant-failure';

const fieldKey = (field: DisclosureField): string => `${field.elementKey}:${field.dimensionKey}:${field.ordinal}`;

/**
 * One module's values under a grant (task 67.9) — each field the organization's wizard shows, with what the
 * organization stored, **read-only and nothing more**: no control, no draft, no validation, because nothing under a
 * grant can write. Fields that do not apply to this organization are left out, as the wizard leaves them out.
 * Reading it writes one access row naming the report and the module.
 */
export function GrantStep({
  grant,
  reportId,
  module,
  onBack,
  onClose,
}: {
  readonly grant: GrantScope;
  readonly reportId: string;
  readonly module: string;
  readonly onBack: () => void;
  readonly onClose: () => void;
}) {
  const t = useTranslations('platform.supportAccess.grant');
  const format = useFormatter();
  const query = useQuery(grantStepQuery({ ...grant, reportId, module }));

  if (query.data === undefined) return <SupportAccessLoading />;
  if (query.data.status !== API_OUTCOME.Ok) {
    return <GrantFailure failure={query.data} onRetry={() => void query.refetch()} onClose={onClose} />;
  }

  const shown = (field: DisclosureField): string => {
    const display = fieldDisplayOf(field);
    switch (display.kind) {
      case FIELD_DISPLAY.NUMBER:
        return format.number(display.value);
      case FIELD_DISPLAY.WORDS:
        return display.text;
      case FIELD_DISPLAY.YES:
        return t('yes');
      case FIELD_DISPLAY.NO:
        return t('no');
      case FIELD_DISPLAY.NONE:
        return t('noValue');
    }
  };

  return (
    <div className="flex flex-col gap-[var(--space-3)]">
      <div>
        <Button type="button" variant={BUTTON_VARIANT.SUBTLE} onClick={onBack}>
          {t('backToModules')}
        </Button>
      </div>
      <h3 className="t-body-strong">{t('fields', { module })}</h3>
      <dl className="t-body grid grid-cols-[minmax(12rem,1fr)_2fr] gap-x-[var(--space-4)] gap-y-[var(--space-2)]">
        {query.data.value.fields
          .filter((field) => field.applicable)
          .map((field) => (
            <Fragment key={fieldKey(field)}>
              <dt className="text-[var(--text-muted)]">
                {field.label ?? t('unlabelled')}
                {field.dimensionLabel === null ? null : <span className="block">{field.dimensionLabel}</span>}
              </dt>
              <dd>{shown(field)}</dd>
            </Fragment>
          ))}
      </dl>
    </div>
  );
}
