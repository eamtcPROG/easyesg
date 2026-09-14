import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  API_OUTCOME,
  type ApiFailure,
  type OrganizationRegisterRow,
  type RaiseSupportAccessRequest,
} from '@easyesg/contracts';
import { BUTTON_VARIANT, Button, Panel } from '@easyesg/ui';
import { FormSummary, FormTextArea, FormTextField } from '@easyesg/ui/forms';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslations } from 'use-intl';
import { RefusalCallout } from '~/realm/components/shared/refusal-callout';
import { SUPPORT_ACCESS_QUERY_KEY, raiseSupportAccess } from '../../../queries/support-access';

/** The api's cost bounds (`RaiseSupportAccessRequestDto`), restated so a person meets them before submitting. */
const TICKET_MAX = 64;
const REASON_MAX = 500;

type RequestFields = Pick<RaiseSupportAccessRequest, 'ticketReference' | 'reason'>;

/**
 * A-07's request (task 67.9; UC-85) — a ticket reference and a reason, both required (UX-124), against one named
 * organization. **The duration and the mode are shown and not offered**: 60 minutes from the grant and read-only
 * are fixed (project owner, 14 Sep 2026), so a control for either would be a choice that does not exist.
 *
 * **The reason is a multi-line field**: the organization reads it before answering, and it may run to 500 characters.
 * It shipped single-line until `FormTextArea` joined `@easyesg/ui/forms` (14 Sep 2026, UX-89 amended the same day).
 *
 * The refusal is one value with a lifecycle, cleared on the next submission — A-08's invitation form's reading.
 */
export function RequestForm({
  organization,
  onSent,
  onCancel,
}: {
  readonly organization: OrganizationRegisterRow;
  readonly onSent: (organizationName: string) => void;
  readonly onCancel: () => void;
}) {
  const t = useTranslations('platform.supportAccess.request');
  const queryClient = useQueryClient();
  const { control, handleSubmit } = useForm<RequestFields>({ mode: 'onTouched' });
  const [failure, setFailure] = useState<ApiFailure | null>(null);

  const { mutate: raise, isPending } = useMutation({
    mutationFn: raiseSupportAccess,
    onSuccess: (outcome) => {
      if (outcome.status !== API_OUTCOME.Ok) {
        setFailure(outcome);
        return;
      }
      void queryClient.invalidateQueries({ queryKey: SUPPORT_ACCESS_QUERY_KEY });
      onSent(organization.name);
    },
  });

  const submit = handleSubmit((fields) => {
    setFailure(null);
    raise({ organizationId: organization.id, ...fields });
  });

  return (
    <section aria-label={t('region')}>
      <Panel className="flex flex-col gap-[var(--space-4)] p-[var(--space-5)]">
        <h2 className="t-heading-3">{t('title')}</h2>
        <p className="t-body text-[var(--text-muted)]">{t('lede')}</p>

        {failure === null ? null : (
          <RefusalCallout failure={failure} title={t('problemTitle')} fallback={t('problemTitle')} />
        )}

        <dl className="t-body grid grid-cols-[auto_1fr] gap-x-[var(--space-4)] gap-y-[var(--space-2)]">
          <dt className="text-[var(--text-muted)]">{t('organization')}</dt>
          <dd>{organization.name}</dd>
          <dt className="text-[var(--text-muted)]">{t('duration')}</dt>
          <dd>{t('durationValue')}</dd>
          <dt className="text-[var(--text-muted)]">{t('mode')}</dt>
          <dd>{t('modeValue')}</dd>
        </dl>

        <form
          method="post"
          onSubmit={(event) => void submit(event)}
          noValidate
          className="flex flex-col gap-[var(--space-4)]"
        >
          <FormSummary control={control} title={t('summaryTitle')} />

          <FormTextField
            control={control}
            name="ticketReference"
            label={t('ticketLabel')}
            autoComplete="off"
            rules={{
              required: t('ticketMissing'),
              validate: (value) => value.trim() !== '' || t('ticketMissing'),
              maxLength: { value: TICKET_MAX, message: t('ticketTooLong') },
            }}
          />

          <FormTextArea
            control={control}
            name="reason"
            label={t('reasonLabel')}
            help={t('reasonHelp')}
            autoComplete="off"
            rules={{
              required: t('reasonMissing'),
              validate: (value) => value.trim() !== '' || t('reasonMissing'),
              maxLength: { value: REASON_MAX, message: t('reasonTooLong') },
            }}
          />

          <div className="flex flex-wrap gap-[var(--space-3)]">
            <Button type="submit" busy={isPending}>
              {t('submit')}
            </Button>
            <Button type="button" variant={BUTTON_VARIANT.SECONDARY} onClick={onCancel}>
              {t('cancel')}
            </Button>
          </div>
        </form>
      </Panel>
    </section>
  );
}
