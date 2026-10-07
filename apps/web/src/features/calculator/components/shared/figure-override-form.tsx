'use client';

import { Button, BUTTON_VARIANT } from '@easyesg/ui';
import { FormSummary, FormTextArea, FormTextField } from '@easyesg/ui/forms';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { readFigure } from '../../tools/figure-input';
import { CALCULATOR_MESSAGES } from './calculator-messages';
import styles from '../styles/calculator.module.css';

/**
 * *Replace this figure with my own* (task 39.3; UC-34, UX-43; the artboard's 8.5): the reporter's tonnes and **why**.
 *
 * **The reason is required, and the rule carries its message** — `@easyesg/ui/forms`' `BoundRules` narrows a bare
 * `required: true` out of the type precisely because a message-less rule renders no inline text, no `aria-invalid` and
 * no summary entry, so the form would refuse in silence. UX-43: an unexplained substituted figure is never presentable,
 * and this is the point of substitution, where the reader can still be asked. The api refuses the same blank reason.
 *
 * **In `shared/` because two regions draw it** — B3's scope control (`figure/`) and an invoice line (`lines/`); what
 * it hands back is each caller's to write, a direct request for the one and the queue for the other.
 */
interface OverrideFields {
  tonnes: string;
  reason: string;
}

export function FigureOverrideForm({
  initial,
  pending,
  onSubmit,
  onCancel,
  cancelLabel,
}: {
  /** The substitute and its reason, where one already stands and is being changed. */
  readonly initial: { readonly tonnes: string; readonly reason: string } | null;
  readonly pending: boolean;
  readonly onSubmit: (override: { readonly tonnesCo2e: string; readonly explanation: string }) => void;
  readonly onCancel: () => void;
  /** *Keep the computed figure* where nothing has been replaced yet; *cancel* where a substitute stands. */
  readonly cancelLabel: string;
}) {
  const t = useTranslations(`${CALCULATOR_MESSAGES}.override`);
  const tLine = useTranslations(`${CALCULATOR_MESSAGES}.line`);
  const tForms = useTranslations('forms');
  const { control, handleSubmit } = useForm<OverrideFields>({
    defaultValues: { tonnes: initial?.tonnes ?? '', reason: initial?.reason ?? '' },
  });

  const submit = handleSubmit((fields) => {
    const figure = readFigure(fields.tonnes);
    if (!('value' in figure) || figure.value === null) return;
    onSubmit({ tonnesCo2e: figure.value, explanation: fields.reason.trim() });
  });

  return (
    <form method="post" noValidate onSubmit={(event) => void submit(event)} className={styles.overrideForm}>
      <FormSummary control={control} title={tForms('summaryTitle')} />
      <FormTextField
        control={control}
        name="tonnes"
        label={t('tonnes')}
        inputMode="decimal"
        rules={{
          required: t('tonnesRequired'),
          validate: (value) => {
            const figure = readFigure(value);
            return ('value' in figure && figure.value !== null) || tLine('invalidNumber');
          },
        }}
      />
      <FormTextArea
        control={control}
        name="reason"
        label={t('reason')}
        help={t('reasonHelp')}
        rules={{
          required: t('reasonRequired'),
          validate: (value) => value.trim() !== '' || t('reasonRequired'),
        }}
      />
      <div className={styles.addingActions}>
        <Button type="button" variant={BUTTON_VARIANT.SECONDARY} onClick={onCancel}>
          {cancelLabel}
        </Button>
        <Button type="submit" busy={pending}>
          {t('use')}
        </Button>
      </div>
    </form>
  );
}
