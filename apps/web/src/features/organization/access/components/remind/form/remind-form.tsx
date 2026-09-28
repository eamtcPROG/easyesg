'use client';

import { Button, BUTTON_VARIANT } from '@easyesg/ui';
import { FormSelect, FormSummary, FormTextArea } from '@easyesg/ui/forms';
import { useTranslations } from 'next-intl';
import { useId, useTransition } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { API_OUTCOME } from '@/lib/api-outcome';
import { failureNotice, successNotice } from '@/lib/notice';
import { sendReminderAction } from '../../../actions/actions';
import { ACCESS_PANEL } from '../../../tools/access-panel';
import { NOTICE_REGION } from '../../../tools/access-state';
import {
  REMINDER_NOTE_MAX_LENGTH,
  offeredPerson,
  type ReminderPerson,
  type ReminderReport,
} from '../../../tools/reminder';
import { AccessDialog } from '../../shared/access-dialog';
import { useAccess } from '../../shared/access-context';
import { REMIND_MESSAGES } from '../shared/remind-messages';
import styles from '../../styles/access.module.css';

interface RemindFields {
  membershipId: string;
  reportId: string;
  note: string;
}

/**
 * UC-175's form: who, about which report, and an optional note (task 50.3; §12.5.6's task-50.3 rows (1), (4)).
 *
 * **In a dialogue since 28 Sep 2026**, framing itself as the invitation's form does: *Cancel* and *Send* stand in the
 * dialogue's closing row, the submit belonging to the form by its `form` attribute. **Opened from a member's row it
 * starts with them chosen** (`person`), and only if the form offers them — a row the list drew before they stopped
 * being a member chooses nobody rather than someone the api would refuse.
 *
 * **Each press sends a reminder of its own** (row (3)): a sent one closes the dialogue and is reported at the list's
 * head, and the next opening is a new form — a second press is a second notice, which is the rule and not a double
 * submit. A refusal stays in the dialogue, above the form it refused.
 *
 * **Every refusal is the API's** — the report no longer open, the person no longer a member, the sender named as the
 * recipient — rendered as received, as the invite form renders its own: the API's copy knows which happened, and
 * its *what now* is already in its words, so the notice carries no action of this screen's.
 */
export function RemindForm({
  people,
  reports,
  person,
}: {
  readonly people: readonly ReminderPerson[];
  readonly reports: readonly ReminderReport[];
  /** The membership the reminder was opened for, from a row's action — `null` from the filter row's button. */
  readonly person: string | null;
}) {
  const t = useTranslations(REMIND_MESSAGES);
  const tCommon = useTranslations('identity');
  const tForms = useTranslations('forms');
  const [pending, startTransition] = useTransition();
  const formId = useId();
  const { starting, report, closePanel } = useAccess();

  const { control, handleSubmit } = useForm<RemindFields>({
    defaultValues: { note: '', membershipId: offeredPerson({ people, person }) ?? undefined },
  });
  const note = useWatch({ control, name: 'note' });

  const submit = handleSubmit((fields) => {
    starting();
    startTransition(async () => {
      const result = await sendReminderAction({
        reportId: fields.reportId,
        membershipId: fields.membershipId,
        // As written: the api trims it and reads an empty one as none, so this tier keeps no second copy of that rule.
        note: fields.note,
      });
      const name = people.find((person) => person.membershipId === fields.membershipId)?.displayName ?? '';

      if (result.status === API_OUTCOME.Ok) {
        // Reported first, then closed: the dialogue's closing clears only a notice of its own region.
        report({
          region: NOTICE_REGION.LIST,
          ...successNotice({ copy: { title: t('sent', { name }), body: t('sentBody') } }),
        });
        closePanel();
        return;
      }
      report({
        region: NOTICE_REGION.REMIND,
        ...failureNotice({
          outcome: result,
          unreachable: { title: tCommon('unreachable.title'), body: tCommon('unreachable.body') },
        }),
      });
    });
  });

  return (
    <AccessDialog
      panel={ACCESS_PANEL.REMIND}
      title={t('heading')}
      footer={
        <>
          <Button type="button" variant={BUTTON_VARIANT.SECONDARY} onClick={closePanel}>
            {t('cancel')}
          </Button>
          <Button type="submit" form={formId} busy={pending}>
            {t('submit')}
          </Button>
        </>
      }
    >
      <p className={`t-body ${styles.lede}`}>{t('intro')}</p>
      <form
        id={formId}
        method="post"
        onSubmit={(event) => void submit(event)}
        noValidate
        className={styles.dialogForm}
      >
        <FormSummary control={control} title={tForms('summaryTitle')} />
        <FormSelect
          control={control}
          name="membershipId"
          label={t('person')}
          placeholder={t('personPlaceholder')}
          options={people.map((person) => ({
            value: person.membershipId,
            label: person.displayName,
            description: person.email,
          }))}
          rules={{ required: t('personRequired') }}
        />
        <FormSelect
          control={control}
          name="reportId"
          label={t('report')}
          placeholder={t('reportPlaceholder')}
          options={reports.map((option) => ({
            value: option.id,
            // The year as text: ICU would give a number the locale's thousands separator.
            label: t('reportOption', { entity: option.entityName, year: String(option.fiscalYear) }),
          }))}
          rules={{ required: t('reportRequired') }}
        />
        <FormTextArea
          control={control}
          name="note"
          label={t('note')}
          help={t('noteHelp')}
          count={t('noteCount', { used: note.length, limit: REMINDER_NOTE_MAX_LENGTH })}
          rules={{ maxLength: { value: REMINDER_NOTE_MAX_LENGTH, message: t('noteTooLong', { limit: REMINDER_NOTE_MAX_LENGTH }) } }}
        />
      </form>
    </AccessDialog>
  );
}
