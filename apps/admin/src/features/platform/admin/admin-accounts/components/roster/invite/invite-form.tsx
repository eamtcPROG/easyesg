import { useMutation } from '@tanstack/react-query';
import {
  ADMIN_ROLE,
  API_OUTCOME,
  type ApiFailure,
  type InviteAdministratorRequest,
} from '@easyesg/contracts';
import { BUTTON_VARIANT, Button, Panel } from '@easyesg/ui';
import { FormSelect, FormSummary, FormTextField } from '@easyesg/ui/forms';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslations } from 'use-intl';
import { RefusalCallout } from '~/realm/components/shared/refusal-callout';
import { EMAIL_SHAPE } from '~/realm/tools/email-shape';
import { inviteAdministrator } from '../../../queries/account-actions';

/**
 * A-08's invitation form (task 67.4; UC-87) — an address and a realm, and a link goes out for 24
 * hours. **No password, no factor, nothing the inviter could hold**: the invitee sets both on A-20.
 *
 * The refusal is one value with a lifecycle, cleared on the next submission — a `useState`, CLAUDE.md's
 * reading, because nothing else moves with it.
 */
export function InviteForm({
  onSent,
  onCancel,
}: {
  readonly onSent: (email: string) => void;
  readonly onCancel: () => void;
}) {
  const t = useTranslations('platform.accounts.inviteForm');
  const tRealm = useTranslations('realm.chrome.realm');
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
    <aside aria-label={t('region')}>
      <Panel className="flex flex-col gap-[var(--space-4)] p-[var(--space-5)]">
        <h2 className="t-heading-3">{t('title')}</h2>
        <p className="t-body text-[var(--text-muted)]">{t('lede')}</p>

        {failure === null ? null : (
          <RefusalCallout failure={failure} title={t('problemTitle')} fallback={t('problemTitle')} />
        )}

        <form
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
    </aside>
  );
}
