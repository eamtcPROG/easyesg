import { useMutation, useQueryClient } from '@tanstack/react-query';
import { API_OUTCOME, type ApiFailure } from '@easyesg/contracts';
import { BUTTON_VARIANT, Button, useDismissible } from '@easyesg/ui';
import { FormSummary, FormTextArea } from '@easyesg/ui/forms';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslations } from 'use-intl';
import { ExpiringRefusal } from '~/realm/components/shared/expiring-refusal';
import { organizationMembersQuery, releaseMemberLockout } from '../../../queries/organization-members';

/** FR-209's bound on the reason — A-07's length (FR-78), which the api's DTO and the audit column's `CHECK` restate. */
const REASON_MAX = 500;

/** Where the control stands: offered, asking for the reason, or done. Internal to this file. */
const LOCKOUT_STAGE = {
  OFFERED: 'offered',
  ASKING: 'asking',
  RELEASED: 'released',
} as const;

type LockoutStage = (typeof LOCKOUT_STAGE)[keyof typeof LOCKOUT_STAGE];

/**
 * A locked member's release, in A-02's record (task 67.12; UC-214, FR-209; §12.5.6's task-67.12 row) — the person's
 * way back when the reset mail cannot reach them. **It asks for a reason before it acts**: the reason is written with
 * the system audit row A-08 reads, as every Platform Administrator act is attributed (182/1).
 *
 * **Inline under the person, not a second dialogue**: the record is already one, and a dialogue over a dialogue would
 * leave the person it is about out of view. Once released, the record's people are read again, so the lock leaves the
 * list and this says what happened in its place.
 */
export function MemberLockout({
  organizationId,
  accountId,
  locked,
}: {
  readonly organizationId: string;
  readonly accountId: string;
  readonly locked: boolean;
}) {
  const t = useTranslations('platform.organizations.record.members.lockout');
  const queryClient = useQueryClient();
  const [stage, setStage] = useState<LockoutStage>(LOCKOUT_STAGE.OFFERED);
  const [failure, setFailure] = useState<ApiFailure | null>(null);
  // A refusal leaves after a while, or when closed (design_spec.md §8.1, 28 Sep 2026).
  const [shownFailure, dismissFailure] = useDismissible(failure);
  const { control, handleSubmit } = useForm<{ reason: string }>({ mode: 'onTouched', defaultValues: { reason: '' } });

  const { mutate: release, isPending } = useMutation({
    mutationFn: releaseMemberLockout,
    onSuccess: (outcome) => {
      if (outcome.status !== API_OUTCOME.Ok) {
        setFailure(outcome);
        return;
      }
      setStage(LOCKOUT_STAGE.RELEASED);
      void queryClient.invalidateQueries({ queryKey: organizationMembersQuery(organizationId).queryKey });
    },
  });

  if (stage === LOCKOUT_STAGE.RELEASED) {
    return (
      <p role="status" className="t-caption text-[var(--text-muted)]">
        {t('released')}
      </p>
    );
  }
  if (!locked) return null;

  const submit = handleSubmit(({ reason }) => {
    setFailure(null);
    release({ organizationId, accountId, reason: reason.trim() });
  });

  return (
    <div className="flex flex-col gap-[var(--space-2)]">
      <span className="t-caption text-[var(--text-muted)]">{t('locked')}</span>
      {stage === LOCKOUT_STAGE.OFFERED ? (
        <div>
          <Button type="button" variant={BUTTON_VARIANT.SECONDARY} onClick={() => setStage(LOCKOUT_STAGE.ASKING)}>
            {t('release')}
          </Button>
        </div>
      ) : (
        <form
          method="post"
          onSubmit={(event) => void submit(event)}
          noValidate
          className="flex flex-col gap-[var(--space-3)]"
        >
          <FormSummary control={control} title={t('problemTitle')} />
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
              {t('confirm')}
            </Button>
            <Button type="button" variant={BUTTON_VARIANT.SECONDARY} onClick={() => setStage(LOCKOUT_STAGE.OFFERED)}>
              {t('cancel')}
            </Button>
          </div>
        </form>
      )}
      {shownFailure === null ? null : (
        <ExpiringRefusal
          failure={shownFailure}
          title={t('problemTitle')}
          fallback={t('problemBody')}
          onDismiss={dismissFailure}
        />
      )}
    </div>
  );
}
