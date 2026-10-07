'use client';

import type { CalcFactorSource, CalcSite } from '@easyesg/contracts';
import { Button, BUTTON_VARIANT } from '@easyesg/ui';
import { FormCheckbox, FormSelect, FormSummary, FormTextArea, FormTextField } from '@easyesg/ui/forms';
import { useTranslations } from 'next-intl';
import { useId } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import type { CalcLineWrite } from '@/features/wizard/tools/autosave-state';
import { readFigure } from '../../tools/figure-input';
import { sourceGroups } from '../../tools/source-groups';
import { CALCULATOR_MESSAGES } from '../shared/calculator-messages';
import { useCalculatorWords } from '../shared/use-calculator-words';
import styles from '../styles/calculator.module.css';

/**
 * *Add a source* (task 39.1; the artboard's 8.3): what the bill is for, at which site, and the figure in the unit
 * printed on it — or that the bill has no figure, and why. Submitting puts the new line into the wizard's queue under a
 * fresh id (§12.5.6's task-39 row (2)), so it is on screen at once and sent when the network allows; nothing here waits
 * on a request.
 *
 * **The units offered are the chosen source's own**, and each source keeps its own unit in the form
 * (`units.<source>`), so choosing another source shows that source's choice rather than carrying a unit across that
 * it does not admit — derived from the choice, with no effect to clear a stale one. A source entered in one unit asks
 * nothing. **The sources are grouped as the artboard groups them** — fuel you burn, electricity you buy, the B3 figure
 * each counts toward — and each option says which.
 *
 * The rules are the form's own (root `CLAUDE.md`): required, *must read as a figure*. Whether the source, unit and
 * site are ones the report admits is the api's to say when the line arrives, and it says it through the queue.
 */
interface AddSourceFields {
  sourceKey: string;
  siteOrdinal: string;
  quantity: string;
  units: Record<string, string>;
  noFigure: boolean;
  reason: string;
}

export function AddSource({
  sources,
  sites,
  site,
  onAdd,
  onCancel,
}: {
  readonly sources: readonly CalcFactorSource[];
  readonly sites: readonly CalcSite[];
  /** The site the form was opened at, or `null` from the toolbar. */
  readonly site: number | null;
  readonly onAdd: (line: CalcLineWrite) => void;
  readonly onCancel: () => void;
}) {
  const t = useTranslations(`${CALCULATOR_MESSAGES}.add`);
  const tSites = useTranslations(`${CALCULATOR_MESSAGES}.sites`);
  const tLine = useTranslations(`${CALCULATOR_MESSAGES}.line`);
  const tForms = useTranslations('forms');
  const { sourceName, unitName, groupName } = useCalculatorWords();
  const formId = useId();
  const only = sites.length === 1 ? sites[0].ordinal : null;
  const { control, handleSubmit } = useForm<AddSourceFields>({
    defaultValues: {
      sourceKey: '',
      siteOrdinal: String(site ?? only ?? ''),
      quantity: '',
      units: {},
      noFigure: false,
      reason: '',
    },
  });
  const sourceKey = useWatch({ control, name: 'sourceKey' });
  const noFigure = useWatch({ control, name: 'noFigure' });
  const units = sources.find((source) => source.key === sourceKey)?.units ?? [];

  const submit = handleSubmit((fields) => {
    const base = { siteOrdinal: Number(fields.siteOrdinal), sourceKey: fields.sourceKey, description: null };
    const figure = readFigure(fields.quantity);
    const unitCode = units.length === 1 ? units[0] : (fields.units[fields.sourceKey] ?? '');
    onAdd({
      lineId: crypto.randomUUID(),
      line: fields.noFigure
        ? { ...base, notAvailableReason: fields.reason.trim() }
        : { ...base, quantity: 'value' in figure ? figure.value : null, unitCode },
    });
  });

  return (
    <section className={styles.adding} aria-labelledby={`${formId}-heading`}>
      <h2 id={`${formId}-heading`} className={styles.addingHeading}>
        {t('heading')}
      </h2>
      <form id={formId} method="post" noValidate onSubmit={(event) => void submit(event)} className={styles.addingForm}>
        <FormSummary control={control} title={tForms('summaryTitle')} />
        <FormSelect
          control={control}
          name="sourceKey"
          label={t('source')}
          help={t('sourceHelp')}
          placeholder={t('chooseSource')}
          options={sourceGroups(sources).flatMap((group) =>
            group.sources.map((source) => ({
              value: source.key,
              label: sourceName(source.key),
              description: groupName(group.scope),
            })),
          )}
          rules={{ required: t('sourceRequired') }}
        />
        {only === null ? (
          <FormSelect
            control={control}
            name="siteOrdinal"
            label={t('site')}
            placeholder={t('chooseSite')}
            options={sites.map((each) => ({
              value: String(each.ordinal),
              label: each.name ?? tSites('unnamed', { position: each.ordinal + 1 }),
            }))}
            rules={{ required: t('siteRequired') }}
          />
        ) : null}
        <FormCheckbox control={control} name="noFigure" label={t('noFigure')} />
        {noFigure ? (
          <FormTextArea
            control={control}
            name="reason"
            label={t('reason')}
            help={tLine('reasonHelp')}
            rules={{ validate: (value) => value.trim() !== '' || t('reasonRequired') }}
          />
        ) : (
          <div className={styles.addingFigure}>
            <FormTextField
              control={control}
              name="quantity"
              label={t('quantity')}
              inputMode="decimal"
              rules={{
                required: t('quantityRequired'),
                validate: (value) => {
                  const figure = readFigure(value);
                  return ('value' in figure && figure.value !== null) || tLine('invalidNumber');
                },
              }}
            />
            {units.length > 1 ? (
              <FormSelect
                key={sourceKey}
                control={control}
                name={`units.${sourceKey}`}
                label={t('unit')}
                placeholder={tLine('chooseUnit')}
                options={units.map((code) => ({ value: code, label: unitName(code) }))}
                rules={{ required: t('unitRequired') }}
              />
            ) : units.length === 1 ? (
              <p className={styles.addingUnit}>{unitName(units[0])}</p>
            ) : null}
          </div>
        )}
        <div className={styles.addingActions}>
          <Button type="button" variant={BUTTON_VARIANT.SECONDARY} onClick={onCancel}>
            {t('cancel')}
          </Button>
          <Button type="submit">{t('submit')}</Button>
        </div>
      </form>
    </section>
  );
}
