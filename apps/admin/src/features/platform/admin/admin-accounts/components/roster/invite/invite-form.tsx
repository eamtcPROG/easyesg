import { useMutation } from '@tanstack/react-query';
import {
  ADMIN_ROLE,
  API_OUTCOME,
  type ApiFailure,
  type InviteAdministratorRequest,
} from '@easyesg/contracts';
import { BUTTON_VARIANT, Button, Dialog } from '@easyesg/ui';
import { FormSelect, FormSummary, FormTextField } from '@easyesg/ui/forms';
import { useId, useMemo, useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslations } from 'use-intl';
import { RefusalCallout } from '~/realm/components/shared/refusal-callout';
import { EMAIL_SHAPE } from '~/realm/tools/email-shape';
import { inviteAdministrator } from '../../../queries/account-actions';

/**
 * A-08's invitation form (task 67.4; UC-87) — an address and a realm, and a link goes out for 24
 * hours. **No password, no factor, nothing the inviter could hold**: the invitee sets both on A-20.
 *
 * **In a dialogue over the roster since task 170** (`design_spec.md` §5.2's preamble: *a form that
 * creates a record opens in a dialogue*), and still at `?panel=invite`, so a reload reopens it. Its
 * submit stands in the dialogue's closing row, which stays in view while the body scrolls, and belongs
 * to the form by its `form` attribute — so it is still the form's default button, the one implicit
 * submission from the address field presses.
 *
 * The refusal is one value with a lifecycle, cleared on the next submission — a `useState`, CLAUDE.md's
 * reading, because nothing else moves with it. `notice` is the board's announcement, placed here while
 * the form covers the page.
 */
export function InviteForm({
  notice,
  onSent,
  onCancel,
}: {
  /** What the last action on the roster did, or why it was refused — `AccountNotice`. */
  readonly notice: ReactNode;
  readonly onSent: (email: string) => void;
  readonly onCancel: () => void;
}) {
  const t = useTranslations('platform.accounts.inviteForm');
  const tRealm = useTranslations('realm.chrome.realm');
  const tChrome = useTranslations('chrome.dialog');
  const formId = useId();
  const { control, handleSubmit } = useForm<InviteAdministratorRequest>({ mode: 'onTouched' });
  const [failure, setFailure] = useState<ApiFailure | null>(null);

  const { mutate: invite, isPending } = useMutation({
    mutationFn: inviteAdministrator,
    onSuccess: (outcome) => {
      if (outcome.status === API_OUTCOME.Ok) onSent(outcome.value.email);
      else setFailure(outcome);
    },
  });

  const roles = useMemo(
    () => Object.values(ADMIN_ROLE).map((role) => ({ value: role, label: tRealm(role) })),
    [tRealm],
  );

  const submit = handleSubmit((command) => {
    setFailure(null);
    invite(command);
  });

  return (
    <Dialog
      open
      onClose={onCancel}
      title={t('title')}
      description={t('lede')}
      closeLabel={tChrome('close')}
      footer={
        <>
          <Button type="button" variant={BUTTON_VARIANT.SECONDARY} onClick={onCancel}>
            {t('cancel')}
          </Button>
          <Button type="submit" form={formId} busy={isPending}>
            {t('submit')}
          </Button>
        </>
      }
    >
      {notice}

      {failure === null ? null : (
        <RefusalCallout failure={failure} title={t('problemTitle')} fallback={t('problemTitle')} />
      )}

      <form
        id={formId}
        method="post"
        onSubmit={(event) => void submit(event)}
        noValidate
        className="flex flex-col gap-[var(--space-4)]"
      >
        <FormSummary control={control} title={t('summaryTitle')} />

        <FormTextField
          control={control}
          name="email"
          label={t('emailLabel')}
          type="email"
          autoComplete="off"
          inputMode="email"
          rules={{
            required: t('emailMissing'),
            pattern: { value: EMAIL_SHAPE, message: t('emailInvalid') },
          }}
        />

        <FormSelect
          control={control}
          name="role"
          label={t('roleLabel')}
          placeholder={t('rolePlaceholder')}
          options={roles}
          rules={{ required: t('roleMissing') }}
        />
      </form>
    </Dialog>
  );
}
