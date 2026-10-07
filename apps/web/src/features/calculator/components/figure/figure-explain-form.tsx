'use client';

import { Button, BUTTON_VARIANT } from '@easyesg/ui';
import { FormTextArea } from '@easyesg/ui/forms';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { CALCULATOR_MESSAGES } from '../shared/calculator-messages';
import styles from '../styles/calculator.module.css';

/**
 * *Explain this figure* (task 39.3; UC-34's annotate): a note that stays beside a figure the calculator computed, kept
 * through a re-run (§12.5.6's task-38.4 row (5)). **Optional by nature** — an empty note removes the one standing, which
 * is the route's own rule — so the only form-level check there is none to make.
 */
export function FigureExplainForm({
  initial,
  pending,
  onSubmit,
  onCancel,
}: {
  readonly initial: string | null;
  readonly pending: boolean;
  readonly onSubmit: (explanation: string | null) => void;
  readonly onCancel: () => void;
}) {
  const t = useTranslations(`${CALCULATOR_MESSAGES}.figure`);
  const { control, handleSubmit } = useForm<{ note: string }>({ defaultValues: { note: initial ?? '' } });
  const submit = handleSubmit((fields) => onSubmit(fields.note.trim() === '' ? null : fields.note.trim()));

  return (
    <form method="post" noValidate onSubmit={(event) => void submit(event)} className={styles.overrideForm}>
      <FormTextArea control={control} name="note" label={t('note')} help={t('noteHelp')} />
      <div className={styles.addingActions}>
        <Button type="button" variant={BUTTON_VARIANT.SECONDARY} onClick={onCancel}>
          {t('cancel')}
        </Button>
        <Button type="submit" busy={pending}>
          {t('saveNote')}
        </Button>
      </div>
    </form>
  );
}
